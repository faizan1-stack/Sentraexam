# System Architecture Diagram

```mermaid
flowchart LR
    subgraph Client[Client Layer]
      U1[Admin Browser]
      U2[HOD Browser]
      U3[Teacher Browser]
      U4[Student Browser]
      FE[React + Vite SPA]
    end

    subgraph API[Application Layer]
      DJ[Django + DRF API]
      WS[Channels WebSocket
      /ws/notifications/]
      CEL[Celery Worker]
      BEAT[Celery Beat Scheduler]
    end

    subgraph Data[Data & Infra Layer]
      PG[(PostgreSQL)]
      REDIS[(Redis)]
      MEDIA[(Media Storage
      local/ImageKit)]
    end

    subgraph AI[Proctoring / AI Layer]
      CV[OpenCV + NumPy]
      YOLO[Ultralytics YOLO]
      GENAI[Gemini API (optional analysis)]
    end

    U1 --> FE
    U2 --> FE
    U3 --> FE
    U4 --> FE

    FE -->|REST/JSON| DJ
    FE -->|WebSocket| WS

    DJ --> PG
    DJ --> REDIS
    DJ --> MEDIA

    WS --> REDIS
    CEL --> REDIS
    BEAT --> REDIS
    CEL --> PG
    CEL --> DJ

    DJ --> CV
    DJ --> YOLO
    DJ --> GENAI

    CV --> DJ
    YOLO --> DJ
    GENAI --> DJ
```

## Notes
- REST APIs are exposed under `/api/*`.
- Real-time notifications use Django Channels.
- Async and scheduled jobs are handled by Celery + Redis.
- Proctoring analysis is persisted in proctoring models and linked to exam sessions.
