Project Overview:
iChat is a real-time messaging backend designed for scalability and reliability. It supports authenticated users, group messaging, and asynchronous message persistence.

Architecture Highlights:
Express + Socket.IO for REST and real-time communication

Redis for:
Socket.IO adapter (multi-instance scaling)
Online user presence tracking
RabbitMQ for asynchronous message persistence and notifications
Cron Jobs for batch message persistence every 30 minutes
Firebase Auth for token-based authentication
GitHub Actions CI for automated testing

Message Flow
Client sends message via Socket.IO
Message is broadcast instantly to connected clients
Message is pushed to RabbitMQ
Background worker / cron job persists messages to the database
