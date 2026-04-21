# Spring 생태계 개요

> 최초 작성: 2026-04-21

---

## Spring이란

Spring은 Java 엔터프라이즈 애플리케이션 개발을 위한 오픈소스 프레임워크 생태계다.
핵심 원칙은 **DI(Dependency Injection)** 와 **AOP(Aspect-Oriented Programming)** 기반의 경량 컨테이너 제공이다.

---

## Spring 주요 프로젝트

| 프로젝트 | 역할 |
|---------|------|
| **Spring Framework** | 핵심 DI 컨테이너, AOP, 트랜잭션 |
| **Spring Boot** | 자동 설정, 내장 서버, 빠른 시작 |
| **Spring MVC** | 웹 애플리케이션 (서블릿 기반) |
| **Spring WebFlux** | 반응형 웹 (비동기/논블로킹) |
| **Spring Data** | 데이터 접근 추상화 (JPA, MongoDB 등) |
| **Spring Security** | 인증/인가 |
| **Spring Batch** | 배치 처리 |
| **Spring Cloud** | 분산 시스템, MSA 지원 |
| **Spring Integration** | 엔터프라이즈 통합 패턴 |

---

## 하위 페이지 — Spring Batch

- [[spring-batch/overview]] — Spring Batch 개요 및 특징
- [[spring-batch/architecture]] — 아키텍처와 계층 구조
- [[spring-batch/domain-language]] — 핵심 도메인 객체
- [[spring-batch/chunk-processing]] — Chunk 기반 처리
- [[spring-batch/scaling]] — 병렬 처리 및 확장
