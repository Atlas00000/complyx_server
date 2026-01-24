<div align="center">

# ⚙️ Complyx Server

### Express.js Backend API

**Robust, Scalable, and Production-Ready Backend Services**

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.9-2D3748.svg)](https://www.prisma.io/)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Services Architecture](#-services-architecture)
- [Testing](#-testing)
- [Security](#-security)
- [Performance](#-performance)
- [Deployment](#-deployment)

---

## 🎯 Overview

The Complyx Server is a robust Express.js backend API that powers the Complyx platform. Built with TypeScript, Prisma ORM, and PostgreSQL, it provides secure, scalable, and performant backend services for IFRS S1 & S2 compliance assessment.

### Key Capabilities

- 🔐 **Authentication & Authorization**: JWT-based auth with RBAC
- 🤖 **AI Integration**: Google Gemini API integration
- 📊 **Assessment Engine**: Multi-phase assessment processing
- 🔍 **Gap Analysis**: Automated compliance gap identification
- 📈 **Analytics**: Real-time metrics and reporting
- 🗄️ **Data Management**: Efficient data storage and retrieval
- 🔄 **Caching**: Redis-based caching for performance
- 📚 **Knowledge Base**: RAG-powered document search

---

## ✨ Features

### Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| **RESTful API** | Comprehensive REST API endpoints | ✅ Complete |
| **Authentication** | JWT-based authentication system | ✅ Complete |
| **Authorization** | Role-based access control (RBAC) | ✅ Complete |
| **Assessment Service** | Multi-phase assessment processing | ✅ Complete |
| **Dashboard API** | Real-time metrics and analytics | ✅ Complete |
| **Gap Analysis** | Automated gap identification | ✅ Complete |
| **Compliance Matrix** | Requirement compliance tracking | ✅ Complete |
| **RAG System** | Retrieval-Augmented Generation | ✅ Complete |
| **File Upload** | Document upload and processing | ✅ Complete |
| **Email Service** | Email notifications and verification | ✅ Complete |

### Advanced Features

- 🔄 **Real-Time Updates**: WebSocket support (optional)
- 📊 **Analytics**: Comprehensive system analytics
- 🔍 **Search**: Full-text search capabilities
- 📝 **Logging**: Structured logging system
- 🛡️ **Rate Limiting**: API rate limiting
- 🔒 **Security**: Comprehensive security measures
- 🐳 **Docker**: Containerized deployment
- 🚀 **Railway Ready**: Optimized for Railway deployment

---

## 🛠️ Tech Stack

### Core Technologies

```yaml
Runtime: Node.js 20+
Framework: Express.js 4.18
Language: TypeScript 5.3
ORM: Prisma 5.9
Database: PostgreSQL 16
Cache: Redis 7
AI: Google Gemini API
```

### Key Dependencies

```yaml
Authentication:
  - jsonwebtoken: JWT token management
  - bcrypt: Password hashing
  - passport: Authentication middleware

Database:
  - @prisma/client: Prisma ORM client
  - prisma: Prisma CLI

AI & ML:
  - @google/generative-ai: Google Gemini API
  - @pinecone-database/pinecone: Vector database

Utilities:
  - axios: HTTP client
  - cheerio: HTML parsing
  - pdf-parse: PDF processing
  - multer: File upload handling
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 16
- Redis >= 7 (optional but recommended)
- Docker (for local development)

### Installation

```bash
# Navigate to server directory
cd server

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
```

### Environment Setup

Create `.env` file:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ifrsbot

# Redis
REDIS_URL=redis://localhost:6379

# AI Provider
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Application URLs
CLIENT_URL=http://localhost:3000
APP_URL=http://localhost:3001
PORT=3001

# Node Environment
NODE_ENV=development
```

### Database Setup

```bash
# Generate Prisma Client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed initial data (optional)
pnpm db:seed:auth
```

### Start Development Server

```bash
# Start development server with hot reload
pnpm dev

# Server runs on http://localhost:3001
```

### Docker Setup (Alternative)

```bash
# Start Docker services
cd docker
docker-compose up -d

# This starts PostgreSQL and Redis
```

---

## 📁 Project Structure

```
server/
├── 📂 src/
│   ├── 📂 routes/                 # API Routes
│   │   ├── auth.ts               # Authentication routes
│   │   ├── chat.ts               # Chat routes
│   │   ├── dashboard.ts         # Dashboard routes
│   │   ├── assessment.ts         # Assessment routes
│   │   └── admin.ts              # Admin routes
│   │
│   ├── 📂 controllers/            # Route Controllers
│   │   ├── authController.ts
│   │   ├── chatController.ts
│   │   ├── dashboardController.ts
│   │   └── adminController.ts
│   │
│   ├── 📂 services/               # Business Logic
│   │   ├── 📂 ai/                 # AI Services
│   │   │   ├── AIService.ts
│   │   │   └── memory/
│   │   ├── 📂 assessment/         # Assessment Services
│   │   │   ├── scoringService.ts
│   │   │   ├── phaseService.ts
│   │   │   └── conversationalAssessment.ts
│   │   ├── 📂 auth/                # Authentication Services
│   │   │   ├── authService.ts
│   │   │   └── rbacService.ts
│   │   ├── 📂 knowledge/           # Knowledge Base Services
│   │   │   ├── ragService.ts
│   │   │   ├── vectorDatabase.ts
│   │   │   └── semanticSearchService.ts
│   │   └── 📂 compliance/         # Compliance Services
│   │       ├── gapIdentificationService.ts
│   │       └── complianceMatrixService.ts
│   │
│   ├── 📂 middleware/             # Express Middleware
│   │   ├── auth.ts               # Authentication middleware
│   │   ├── security.ts           # Security middleware
│   │   └── uploadMiddleware.ts   # File upload middleware
│   │
│   ├── 📂 utils/                  # Utility Functions
│   │   ├── db.ts                 # Database connection
│   │   ├── logger.ts             # Logging utility
│   │   └── validators.ts         # Input validators
│   │
│   └── 📄 server.ts              # Application entry point
│
├── 📂 prisma/                     # Database Schema
│   ├── schema.prisma             # Prisma schema
│   └── 📂 migrations/            # Database migrations
│
├── 📂 docker/                     # Docker Configuration
│   ├── docker-compose.yml        # Docker Compose config
│   ├── 📂 postgres/              # PostgreSQL config
│   └── 📂 redis/                 # Redis config
│
├── 📂 scripts/                    # Utility Scripts
│   ├── testAuth.ts
│   ├── ingestBulkURLs.ts
│   └── testDashboardPhase4.ts
│
├── 📄 railway.json               # Railway deployment config
├── 📄 Dockerfile                 # Docker image definition
└── 📄 package.json               # Dependencies
```

---

## 📡 API Documentation

### Base URL

```
Development: http://localhost:3001
Production: https://your-server.railway.app
```

### Authentication

Most endpoints require authentication via JWT token:

```http
Authorization: Bearer <access_token>
```

### Endpoints

#### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "message": "Complyx API Server is running"
}
```

#### Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/refresh-token
```

#### Chat

```http
POST /api/chat
GET  /api/chat/sessions
GET  /api/chat/sessions/:sessionId
DELETE /api/chat/sessions/:sessionId
```

#### Dashboard

```http
GET /api/dashboard/data
GET /api/dashboard/score
GET /api/dashboard/progress
GET /api/dashboard/gaps
GET /api/dashboard/compliance
```

#### Assessment

```http
POST /api/assessment/start
POST /api/assessment/answer
GET  /api/assessment/:assessmentId
GET  /api/assessment/:assessmentId/status
```

### API Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

---

## 🗄️ Database Schema

### Key Models

#### User
```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String?
  passwordHash  String
  emailVerified Boolean  @default(false)
  roleId        String?
  role          Role?    @relation(fields: [roleId], references: [id])
  sessions      Session[]
  assessments   Assessment[]
}
```

#### Assessment
```prisma
model Assessment {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  ifrsStandard String
  phase        String
  status       String
  answers      Answer[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Database Migrations

```bash
# Create a new migration
pnpm db:migrate dev --name migration_name

# Apply migrations
pnpm db:migrate deploy

# Reset database (development only)
pnpm db:migrate reset
```

---

## 🏗️ Services Architecture

### Service Layer Pattern

Services encapsulate business logic and are organized by domain:

```
Service
  ├── Input Validation
  ├── Business Logic
  ├── Data Access (via Prisma)
  └── Response Formatting
```

### Example Service

```typescript
// services/assessment/scoringService.ts
export class ScoringService {
  async calculateScore(assessmentId: string): Promise<AssessmentScore> {
    // 1. Validate input
    // 2. Fetch assessment data
    // 3. Calculate scores
    // 4. Return formatted result
  }
}
```

### Service Dependencies

```
Controller
  └── Service
      ├── Prisma Client
      ├── Other Services
      └── External APIs
```

---

## 🧪 Testing

### Testing Strategy

We follow industry best practices for backend testing:

#### 1. Unit Testing

Test individual functions and methods:

```typescript
// __tests__/services/scoringService.test.ts
import { ScoringService } from '@/services/assessment/scoringService';

describe('ScoringService', () => {
  describe('calculateScore', () => {
    it('should calculate correct score', async () => {
      const service = new ScoringService();
      const score = await service.calculateScore('assessment-123');
      expect(score.overallScore).toBe(85);
    });
  });
});
```

#### 2. Integration Testing

Test API endpoints with database:

```typescript
// __tests__/integration/dashboard.test.ts
import request from 'supertest';
import app from '@/server';

describe('Dashboard API', () => {
  it('should return dashboard data', async () => {
    const response = await request(app)
      .get('/api/dashboard/data')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

#### 3. Service Testing

Test service layer in isolation:

```typescript
// __tests__/services/authService.test.ts
describe('AuthService', () => {
  it('should hash password correctly', async () => {
    const hashed = await authService.hashPassword('password123');
    expect(hashed).not.toBe('password123');
    expect(await authService.verifyPassword('password123', hashed)).toBe(true);
  });
});
```

### Testing Tools

- **Jest**: Test framework
- **Supertest**: HTTP assertion library
- **Prisma Mock**: Database mocking
- **MSW**: API mocking

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test suite
pnpm test:auth
pnpm test:integration
```

### Test Coverage Goals

| Component Type | Target Coverage |
|----------------|----------------|
| **Services** | > 85% |
| **Controllers** | > 80% |
| **Middleware** | > 90% |
| **Utilities** | > 95% |

### Testing Best Practices

1. **Arrange-Act-Assert**: Follow AAA pattern
2. **Test Isolation**: Each test should be independent
3. **Mock External Dependencies**: Mock database, APIs, and services
4. **Test Error Cases**: Include error and edge case tests
5. **Fast Execution**: Keep tests fast for quick feedback
6. **Meaningful Names**: Use descriptive test names
7. **Test Data Factories**: Use factories for test data

### Example Test Structure

```typescript
describe('ServiceName', () => {
  // Setup
  beforeEach(() => {
    // Mock dependencies
    jest.clearAllMocks();
  });

  // Happy path
  describe('when operation succeeds', () => {
    it('should return expected result', async () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act
      const result = await service.method(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });
  });

  // Error cases
  describe('when error occurs', () => {
    it('should throw appropriate error', async () => {
      // Test error handling
    });
  });
});
```

### Database Testing

```typescript
// Use test database for integration tests
beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean database
  await prisma.user.deleteMany();
});
```

---

## 🔒 Security

### Security Features

- ✅ **JWT Authentication**: Secure token-based authentication
- ✅ **Password Hashing**: bcrypt with salt rounds
- ✅ **RBAC**: Role-based access control
- ✅ **Rate Limiting**: API rate limiting
- ✅ **CORS**: Configured CORS policies
- ✅ **Input Validation**: Express-validator
- ✅ **SQL Injection Prevention**: Prisma ORM
- ✅ **XSS Protection**: Input sanitization
- ✅ **Helmet.js**: Security headers

### Security Best Practices

1. **Never Log Secrets**: Avoid logging passwords, tokens, or sensitive data
2. **Validate Input**: Always validate and sanitize user input
3. **Use HTTPS**: Enforce HTTPS in production
4. **Regular Updates**: Keep dependencies updated
5. **Security Headers**: Use Helmet.js for security headers
6. **Rate Limiting**: Implement rate limiting for APIs
7. **Error Handling**: Don't expose sensitive error details

---

## ⚡ Performance

### Optimization Strategies

#### 1. Database Optimization

- Use database indexes
- Optimize queries with Prisma
- Use connection pooling
- Implement query caching

#### 2. Caching

```typescript
// Redis caching example
const cacheKey = `dashboard:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const data = await fetchData();
await redis.setex(cacheKey, 300, JSON.stringify(data));
return data;
```

#### 3. Async Operations

- Use async/await for I/O operations
- Implement background jobs for heavy tasks
- Use worker threads for CPU-intensive tasks

### Performance Metrics

- **API Response Time**: < 200ms (p95)
- **Database Query Time**: < 50ms (p95)
- **Concurrent Requests**: 1000+ requests/second
- **Uptime**: 99.9% availability

---

## 🚢 Deployment

### Railway Deployment

The server is optimized for Railway deployment:

1. **Connect Repository**: Import from GitHub
2. **Add Services**: PostgreSQL and Redis
3. **Configure Environment**: Set environment variables
4. **Deploy**: Automatic deployment on push

### Docker Deployment

```bash
# Build Docker image
docker build -t complyx-server .

# Run container
docker run -p 3001:3001 --env-file .env complyx-server
```

### Environment Variables

See [DEPLOYMENT.md](../DEPLOYMENT.md) for complete environment variable reference.

---

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 🤝 Contributing

### Development Guidelines

1. **Follow TypeScript**: Use strict typing
2. **Service Pattern**: Follow service layer pattern
3. **Error Handling**: Use consistent error handling
4. **Logging**: Use structured logging
5. **Testing**: Write tests for new features
6. **Documentation**: Update API documentation

### Code Style

- Use async/await over callbacks
- Prefer composition over inheritance
- Keep functions small and focused
- Use meaningful variable names
- Add JSDoc comments for complex logic

---

<div align="center">

**Built with ❤️ for Complyx**

[⬆ Back to Top](#-complyx-server)

</div>
