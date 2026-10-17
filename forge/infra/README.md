# Forge 인프라

Hetzner Cloud 서버(Ubuntu 24.04) 초기 설정.

## 실행

로컬 PC(WSL)에서:

```bash
scp forge/infra/bootstrap.sh root@<서버IP>:/root/
ssh root@<서버IP> 'bash /root/bootstrap.sh'
```

실행 중 출력되는 Tailscale 로그인 URL을 브라우저에서 열어 승인한다.
Tailscale auth key를 미리 발급했다면 `TS_AUTHKEY=tskey-... bash /root/bootstrap.sh`로 URL 승인 없이 진행할 수 있다.

## 설치/설정 내용

| 항목 | 내용 |
|---|---|
| 계정 | `admin`(sudo, root의 SSH 키 복사), `forge`(에이전트 실행, sudo 없음) |
| SSH | root 로그인·비밀번호 로그인 차단, 키 로그인만 허용 |
| 방화벽 | 공개: SSH(22)만 / Tailscale(`tailscale0`): 전부 허용 |
| 스왑 | 2GB, `vm.swappiness=10` |
| inotify | Metro용으로 감시 한도 상향 |
| 런타임 | Node.js 22, eas-cli, gh, Claude Code(`forge` 계정) |
| 알림 | ntfy (`:2586`, Tailscale 내부에서만 접근, 토픽 `forge`) |
| 보안 | fail2ban, unattended-upgrades |
| 디렉터리 | `/srv/projects` (소유자 `forge`) |

## 실행 후

1. root 세션을 닫기 전에 새 터미널에서 `ssh admin@<서버IP>` 접속을 확인한다.
2. 휴대폰 ntfy 앱에서 `http://<Tailscale IP>:2586`, 토픽 `forge`를 구독한다.
3. `sudo -iu forge` 후 `claude`, `gh auth login`, `eas login`으로 각각 로그인한다.

## 선택: 공개 SSH 닫기

Tailscale 경유(`ssh admin@<Tailscale IP>`)로 접속되는 것을 확인한 뒤:

```bash
sudo ufw delete allow OpenSSH
```

이후에는 Tailscale에 연결된 기기에서만 서버에 접속할 수 있다. Tailscale에 문제가 생기면 Hetzner 콘솔의 웹 콘솔로 복구한다.
