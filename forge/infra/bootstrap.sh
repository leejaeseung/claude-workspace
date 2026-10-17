#!/usr/bin/env bash
# Forge 서버 초기 설정 스크립트
# 대상: Hetzner Cloud, Ubuntu 24.04, 새로 만든 서버에서 root로 1회 실행
#
# 사용법 (로컬 PC에서):
#   scp bootstrap.sh root@<서버IP>:/root/
#   ssh root@<서버IP> 'bash /root/bootstrap.sh'
#
# 선택 환경변수:
#   ADMIN_USER   관리자(sudo) 계정명       기본값: admin
#   FORGE_USER   에이전트 실행 계정명       기본값: forge
#   TS_HOSTNAME  Tailscale 장치 이름        기본값: forge
#   TS_AUTHKEY   Tailscale auth key (없으면 로그인 URL이 출력됨)
#   SWAP_SIZE    스왑 크기                  기본값: 2G
#
# 여러 번 실행해도 안전하도록(idempotent) 작성했습니다.

set -euo pipefail

ADMIN_USER="${ADMIN_USER:-admin}"
FORGE_USER="${FORGE_USER:-forge}"
TS_HOSTNAME="${TS_HOSTNAME:-forge}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
NTFY_PORT=2586
PROJECTS_DIR=/srv/projects

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 0. 사전 점검
# ---------------------------------------------------------------------------
[[ $EUID -eq 0 ]] || die "root로 실행해야 합니다."
. /etc/os-release
[[ "$ID" == "ubuntu" ]] || die "Ubuntu 전용 스크립트입니다. (현재: $ID)"
[[ "$VERSION_ID" == "24.04" ]] || warn "Ubuntu 24.04 기준으로 작성했습니다. (현재: $VERSION_ID)"
[[ -s /root/.ssh/authorized_keys ]] || die "/root/.ssh/authorized_keys가 비어 있습니다. SSH 키 없이 진행하면 접속이 막힙니다."

export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# 1. 기본 패키지
# ---------------------------------------------------------------------------
log "1/9 시스템 업데이트 및 기본 패키지 설치"
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  ca-certificates curl wget gnupg git jq unzip build-essential sqlite3 \
  ufw fail2ban unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# ---------------------------------------------------------------------------
# 2. 계정
#   - ADMIN_USER: 사람이 쓰는 관리자 계정 (sudo, root의 SSH 키 복사)
#   - FORGE_USER: 에이전트 실행 계정 (sudo 없음)
# ---------------------------------------------------------------------------
log "2/9 계정 생성 (${ADMIN_USER}: 관리자, ${FORGE_USER}: 에이전트)"
if ! id "$ADMIN_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$ADMIN_USER"
fi
usermod -aG sudo "$ADMIN_USER"
echo "${ADMIN_USER} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-${ADMIN_USER}"
chmod 440 "/etc/sudoers.d/90-${ADMIN_USER}"
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/${ADMIN_USER}/.ssh"
install -m 600 -o "$ADMIN_USER" -g "$ADMIN_USER" /root/.ssh/authorized_keys "/home/${ADMIN_USER}/.ssh/authorized_keys"

if ! id "$FORGE_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$FORGE_USER"
fi
install -d -m 755 -o "$FORGE_USER" -g "$FORGE_USER" "$PROJECTS_DIR"

# ---------------------------------------------------------------------------
# 3. 스왑 + 커널 설정
# ---------------------------------------------------------------------------
log "3/9 스왑(${SWAP_SIZE}) 및 커널 파라미터"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
cat > /etc/sysctl.d/99-forge.conf <<'EOF'
vm.swappiness=10
# Metro(Expo)가 파일을 많이 감시하므로 inotify 한도를 올림
fs.inotify.max_user_watches=524288
fs.inotify.max_user_instances=512
EOF
sysctl --system >/dev/null

# ---------------------------------------------------------------------------
# 4. Node.js 22 + 전역 CLI
# ---------------------------------------------------------------------------
log "4/9 Node.js 22, eas-cli 설치"
if ! command -v node &>/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g eas-cli

# ---------------------------------------------------------------------------
# 5. GitHub CLI
# ---------------------------------------------------------------------------
log "5/9 GitHub CLI 설치"
if ! command -v gh &>/dev/null; then
  install -d -m 755 /etc/apt/keyrings
  wget -nv -O /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    https://cli.github.com/packages/githubcli-archive-keyring.gpg
  chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update -y
  apt-get install -y gh
fi

# ---------------------------------------------------------------------------
# 6. Claude Code (FORGE_USER 홈에 설치)
# ---------------------------------------------------------------------------
log "6/9 Claude Code 설치 (${FORGE_USER} 계정)"
sudo -u "$FORGE_USER" -i bash -c '
  set -e
  if [[ ! -x "$HOME/.local/bin/claude" ]]; then
    curl -fsSL https://claude.ai/install.sh | bash
  fi
  grep -q ".local/bin" "$HOME/.bashrc" || echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$HOME/.bashrc"
'

# ---------------------------------------------------------------------------
# 7. ntfy (알림 서버, Tailscale 내부에서만 접근)
# ---------------------------------------------------------------------------
log "7/9 ntfy 설치"
if ! command -v ntfy &>/dev/null; then
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL -o /etc/apt/keyrings/ntfy.gpg https://archive.ntfy.sh/apt/keyring.gpg
  echo "deb [signed-by=/etc/apt/keyrings/ntfy.gpg] https://archive.ntfy.sh/apt stable main" \
    > /etc/apt/sources.list.d/ntfy.list
  apt-get update -y
  apt-get install -y ntfy
fi
# base-url은 Tailscale 연결 후 9단계에서 채움
cat > /etc/ntfy/server.yml <<EOF
listen-http: ":${NTFY_PORT}"
behind-proxy: false
EOF
systemctl enable ntfy >/dev/null
systemctl restart ntfy

# ---------------------------------------------------------------------------
# 8. Tailscale
# ---------------------------------------------------------------------------
log "8/9 Tailscale 설치 및 로그인"
if ! command -v tailscale &>/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
if ! tailscale status &>/dev/null; then
  if [[ -n "${TS_AUTHKEY:-}" ]]; then
    tailscale up --ssh --hostname="$TS_HOSTNAME" --authkey="$TS_AUTHKEY"
  else
    warn "아래 출력되는 URL을 브라우저에서 열어 Tailscale 로그인을 승인하세요."
    tailscale up --ssh --hostname="$TS_HOSTNAME"
  fi
fi
TS_IP="$(tailscale ip -4 | head -n1)"

# ---------------------------------------------------------------------------
# 9. 방화벽 + SSH 강화 + 마무리
#   - 공개 인터넷: SSH(22)만 허용 (Tailscale SSH가 확인되면 나중에 닫아도 됨)
#   - tailscale0 인터페이스: 전부 허용 (ntfy, Metro, Forge API)
# ---------------------------------------------------------------------------
log "9/9 방화벽, SSH 강화, ntfy 주소 설정"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow in on tailscale0
ufw --force enable

cat > /etc/ssh/sshd_config.d/99-forge.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF
sshd -t || die "sshd 설정 검증 실패. /etc/ssh/sshd_config.d/99-forge.conf를 확인하세요."
systemctl reload ssh

cat > /etc/ntfy/server.yml <<EOF
base-url: "http://${TS_IP}:${NTFY_PORT}"
listen-http: ":${NTFY_PORT}"
behind-proxy: false
EOF
systemctl restart ntfy
systemctl enable --now fail2ban >/dev/null

sleep 1
curl -fsS -H "Title: Forge" -d "서버 초기 설정 완료 (${TS_HOSTNAME} / ${TS_IP})" \
  "http://127.0.0.1:${NTFY_PORT}/forge" >/dev/null || warn "ntfy 테스트 알림 전송 실패"

cat <<EOF

=====================================================================
 ✅ Forge 서버 초기 설정 완료
=====================================================================
 Tailscale IP : ${TS_IP}  (호스트명: ${TS_HOSTNAME})
 관리자 계정  : ${ADMIN_USER}   (sudo)
 에이전트 계정: ${FORGE_USER}   (sudo 없음, 프로젝트: ${PROJECTS_DIR})
 ntfy         : http://${TS_IP}:${NTFY_PORT}   토픽: forge

 다음 할 일
 1) ⚠️ 이 root 세션을 닫기 전에, 새 터미널에서 접속을 확인하세요.
      ssh ${ADMIN_USER}@<서버 공인 IP>
    (root 로그인과 비밀번호 로그인은 이제 막혀 있습니다.)
 2) 휴대폰 ntfy 앱 → 구독 추가 → 서버 http://${TS_IP}:${NTFY_PORT}, 토픽 forge
    (설정 직후 보낸 테스트 알림은 구독 전이라 안 보일 수 있습니다.)
 3) Claude Code 로그인:
      sudo -iu ${FORGE_USER}
      claude
 4) GitHub 로그인 (Forge 전용 PAT 사용):
      sudo -iu ${FORGE_USER}
      gh auth login
 5) Expo 로그인:
      sudo -iu ${FORGE_USER}
      eas login
=====================================================================
EOF
