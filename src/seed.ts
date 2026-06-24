import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const QUESTIONS_DATA = [
  // 1. System Design & Architecture
  {
    text: "What are the design patterns and system architectures you have worked on? Explain with examples.",
    category: "System Design",
    difficulty: "Hard",
    answerDraft: "• MVC/Layered Architecture: Standard separation of concerns (Express routing -> controllers -> services -> database ORM).\n• Singleton: Used for database connection instances (Prisma client singleton) ensuring one pool is shared.\n• Repository/Service Pattern: Decoupling business logic from database storage engines.\n• Observer (Pub/Sub): Event-driven workflows where Node fires events to Redis/Kafka, and background workers consume them."
  },
  {
    text: "Walk me through the architecture of your most complex project.",
    category: "System Design",
    difficulty: "Hard",
    answerDraft: "• Frontend: React SPA with Zustand state management communicating with APIs using custom hooks.\n• Backend (API Gateway): Express.js handling auth (JWT + HttpOnly), rate limiting, and routing.\n• Compute Microservice: FastAPI/Python handling heavy data processing and model inference.\n• Database & Cache: PostgreSQL managed via Prisma ORM for relational integrity, Redis for distributed session caching."
  },
  {
    text: "Why did you choose React + Express + FastAPI?",
    category: "System Design",
    difficulty: "Medium",
    answerDraft: "• React: Dynamic, fast UI rendering with a clean hook-based state management lifecycle.\n• Express: High-throughput, asynchronous, and single-threaded Node.js gateway that handles user API requests with extremely low latency.\n• FastAPI: Native async capabilities in Python, automatic Pydantic validation, and excellent integration with machine learning/data science libraries."
  },
  {
    text: "How would you design a banking application backend?",
    category: "System Design",
    difficulty: "Hard",
    answerDraft: "• Relational DB: Use PostgreSQL with strict ACID properties and transactional isolation.\n• Locking: Use Pessimistic Write locks (`SELECT FOR UPDATE`) during account balance updates to prevent race conditions.\n• Security: Multi-factor auth, TLS encryption, RBAC on endpoints, and JWT validation via HttpOnly cookies.\n• Audit Log: Immutable transaction tables (append-only ledger style) to record every debit/credit."
  },
  {
    text: "How would you design a file upload service for 100 GB files?",
    category: "System Design",
    difficulty: "Hard",
    answerDraft: "• Chunking: Client slices the file into 10MB chunks using JavaScript `Blob.slice()`.\n• Upload API: Express route uploads chunks to AWS S3 using Multipart Upload APIs.\n• Metadata Tracker: Track uploaded chunk checksums (MD5) and status inside Redis.\n• Finalization: Merge parts in S3 once all chunks are verified, avoiding loading the file into server memory."
  },
  {
    text: "How would you build a large-scale CSV import system?",
    category: "System Design",
    difficulty: "Hard",
    answerDraft: "• Streaming Upload: Upload the CSV directly to S3.\n• Queue Work: Queue a job containing the S3 URL (using BullMQ or Celery).\n• Streaming Parser: Read the file stream from S3 line-by-line using Node/Python streams (never load the whole CSV into RAM).\n• Batch Insertion: Insert rows in batches of 1,000 using bulk COPY commands to PostgreSQL."
  },
  {
    text: "How would you handle millions of requests while keeping response time around 5 ms?",
    category: "System Design",
    difficulty: "Hard",
    answerDraft: "• Edge Caching: CDNs for static endpoints and static page rendering.\n• Distributed Memory Cache: Redis caching for database read queries.\n• Connection Poolers: Use PgBouncer/Prisma Accelerate to handle DB pooling.\n• Non-blocking Event Loops: Keep Express processes stateless and cluster them across CPU cores."
  },
  {
    text: "What are clusters and why are they used?",
    category: "System Design",
    difficulty: "Medium",
    answerDraft: "• Definition: Splitting a single parent Node.js process into multiple child processes (workers) that share the same port.\n• Purpose: Bypasses Node's single-threaded limit to utilize all available CPU cores on the host machine, improving throughput."
  },
  {
    text: "Cluster vs Load Balancer",
    category: "System Design",
    difficulty: "Medium",
    answerDraft: "• Cluster: Runs locally on a single machine, distributing traffic across CPU cores using Node's cluster module.\n• Load Balancer: Distributes network traffic across *multiple separate servers* or container instances (e.g. AWS ALB, Nginx)."
  },
  {
    text: "Cluster vs Worker Threads",
    category: "System Design",
    difficulty: "Medium",
    answerDraft: "• Cluster: Spawns independent operating system processes with separate memory spaces (best for scaling web server instances).\n• Worker Threads: Runs multiple threads *inside the same process* sharing memory (best for offloading heavy, CPU-intensive calculations)."
  },
  {
    text: "What is horizontal scaling? What is vertical scaling?",
    category: "System Design",
    difficulty: "Easy",
    answerDraft: "• Horizontal Scaling: Adding more server nodes (instances) to your system (e.g. running 5 docker replicas). Scale out.\n• Vertical Scaling: Upgrading the CPU, RAM, or storage of your existing server instance. Scale up."
  },

  // 2. Authentication & Session Management
  {
    text: "How do you handle user sessions in a banking application?",
    category: "Auth & Sessions",
    difficulty: "Hard",
    answerDraft: "• Token Storage: Issue a short-lived Access Token (JWT) and store the session record/Refresh Token in a secure Redis cache.\n• Token Transport: Pass the tokens via HttpOnly, Secure, SameSite=Strict cookies.\n• Session Invalidation: Maintain an active blacklist or session lookup in Redis to terminate sessions instantly on suspicious behavior."
  },
  {
    text: "How do Access Tokens and Refresh Tokens work?",
    category: "Auth & Sessions",
    difficulty: "Medium",
    answerDraft: "• Access Token: Short-lived token (15 mins) that client sends in headers to authorize API requests. Stateless.\n• Refresh Token: Long-lived token (7-30 days) used to request new Access Tokens. Stored in DB to manage session lifecycle.\n• Refresh Flow: When Access Token expires (401), the client hits `/refresh` with the Refresh Token to get a fresh Access Token."
  },
  {
    text: "Why store Refresh Tokens in HttpOnly cookies?",
    category: "Auth & Sessions",
    difficulty: "Medium",
    answerDraft: "• Security: HttpOnly cookies cannot be read by JavaScript scripts, completely blocking Access Token theft via XSS (Cross-Site Scripting) attacks.\n• Attributes: Adding `Secure` enforces TLS transmission; `SameSite=Strict` blocks CSRF transmission."
  },
  {
    text: "Why should JWTs not be stored in localStorage?",
    category: "Auth & Sessions",
    difficulty: "Medium",
    answerDraft: "• Vulnerability: LocalStorage is accessible by any JavaScript running in the browser. If your app is hit with an XSS vulnerability, attackers can steal the token immediately."
  },
  {
    text: "What is refresh token rotation?",
    category: "Auth & Sessions",
    difficulty: "Hard",
    answerDraft: "• Definition: Issuing a brand new Refresh Token every single time the client requests a new Access Token.\n• Purpose: Detects token theft. If a used Refresh Token is sent twice, the server invalidates the entire session lineage immediately."
  },
  {
    text: "What is step-up authentication?",
    category: "Auth & Sessions",
    difficulty: "Medium",
    answerDraft: "• Definition: Requiring a higher level of authentication for sensitive actions within a logged-in session.\n• Example: A user is logged in, but when trying to transfer money, the backend prompts for their password or an MFA code."
  },
  {
    text: "What is Multi-Factor Authentication?",
    category: "Auth & Sessions",
    difficulty: "Easy",
    answerDraft: "• Definition: Requiring two or more verification factors to gain access.\n• Factors: Something you know (password), something you have (OTP app, security key), or something you are (biometrics)."
  },
  {
    text: "How would you implement logout from all devices?",
    category: "Auth & Sessions",
    difficulty: "Hard",
    answerDraft: "• Database: Delete all active Refresh Token sessions associated with the user's ID.\n• Blacklisting: If using stateless JWT access tokens, cache the active token signatures in Redis with their TTL so they are rejected immediately."
  },
  {
    text: "How do banks detect suspicious logins?",
    category: "Auth & Sessions",
    difficulty: "Hard",
    answerDraft: "• IP & Geo: Checking for geo-location anomalies (e.g. logging in from New York then Paris 1 hour later).\n• Fingerprinting: Detecting changes in browser headers, operating system, and device signatures.\n• Behavioral: Tracking unusual login hours or access patterns."
  },

  // 3. API Security
  {
    text: "What API protection mechanisms have you implemented?",
    category: "API Security",
    difficulty: "Medium",
    answerDraft: "• Rate Limiting: Restricting requests per IP (using Express-rate-limit + Redis).\n• CORS: Enforcing strict origin white-listing.\n• Security Headers: Adding Helmet middleware to block XSS, Clickjacking, and MIME sniffing.\n• Input Sanitization: Validating and filtering JSON bodies (via express-validator/Zod)."
  },
  {
    text: "Authentication vs Authorization",
    category: "API Security",
    difficulty: "Easy",
    answerDraft: "• Authentication (Who are you?): Validating identity credentials (e.g. email/password verification, JWT matching).\n• Authorization (What can you do?): Checking permissions or roles to see if the identity is permitted to access a resource."
  },
  {
    text: "How do you implement RBAC?",
    category: "API Security",
    difficulty: "Medium",
    answerDraft: "• Role-Based Access Control: Define roles (e.g., ADMIN, MANAGER, CLIENT) on the User schema.\n• Middleware: Write Express middleware that accepts allowed roles and inspects the token payload before forwarding to the controller."
  },
  {
    text: "What is CORS?",
    category: "API Security",
    difficulty: "Easy",
    answerDraft: "• Cross-Origin Resource Sharing: A browser-enforced security mechanism that prevents web pages from making requests to a different domain unless the server explicitly permits it via `Access-Control-Allow-Origin` headers."
  },
  {
    text: "Why shouldn't we use Access-Control-Allow-Origin: *?",
    category: "API Security",
    difficulty: "Medium",
    answerDraft: "• Risk: Wildcard `*` allows any site to read API responses. Crucially, it disables credential passing (cookies or Auth headers cannot be sent with wildcard CORS)."
  },
  {
    text: "How do you prevent brute force attacks?",
    category: "API Security",
    difficulty: "Medium",
    answerDraft: "• Rate Limiting: Lock down requests on Auth endpoints (e.g. max 5 attempts per IP per 15 minutes).\n• Account Lockout: Disable the account login capability temporarily after consecutive failed logins.\n• CAPTCHA: Present verification challenges on login screens."
  },
  {
    text: "How do you prevent SQL Injection?",
    category: "API Security",
    difficulty: "Medium",
    answerDraft: "• Parameterized Queries: Separating SQL query code from user inputs so input is treated strictly as data, not executable code.\n• Prepared Statements: Compiling the SQL code skeleton first, then binding variables.\n• ORMs: Modern tools (Prisma, SQLAlchemy) use parameterized queries natively under the hood."
  },

  // 4. File Upload & Download
  {
    text: "Why does onUploadProgress reaching 100% not mean the upload is complete?",
    category: "File Operations",
    difficulty: "Medium",
    answerDraft: "• Client vs Server: `onUploadProgress` measures the bytes sent from the browser to the network buffer. Once it hits 100%, the server has received the bytes but is still processing them (e.g. disk write, S3 upload, DB validation)."
  },
  {
    text: "How do you show a live progress indicator for a file sent from server to client?",
    category: "File Operations",
    difficulty: "Hard",
    answerDraft: "• Content-Length: The server must send the `Content-Length` header.\n• Streams: On the frontend, read the response body using `ReadableStream` reader. Keep track of chunk sizes received divided by `Content-Length` to calculate progress."
  },

  // 5. Performance & Reliability
  {
    text: "Difference between SLA, SLO, and SLI",
    category: "Performance",
    difficulty: "Medium",
    answerDraft: "• SLA (Agreement): Business contract committing to performance (e.g., 99.9% uptime or money back).\n• SLO (Objective): Target goal of performance (e.g., 95% of queries must resolve in < 100ms).\n• SLI (Indicator): Real-time metric showing actual performance (e.g. current response time is 45ms)."
  },
  {
    text: "What are p50, p95, and p99 latencies?",
    category: "Performance",
    difficulty: "Medium",
    answerDraft: "• p50: Median latency (50% of requests resolved faster than this).\n• p95: Tail latency (95% of requests resolved faster than this; 5% were slower).\n• p99: Worst-case latency (99% of requests resolved faster; only 1% took longer. Used to optimize performance for heavy users)."
  },

  // 6. Memory Management & Debugging
  {
    text: "A backend application grows from 50 GB to 200 GB in a few hours. How would you debug it?",
    category: "Memory & Debugging",
    difficulty: "Hard",
    answerDraft: "• Heap Snapshots: Take heap snapshots at intervals (using Chrome DevTools or Node's `v8` module).\n• Compare: Look for delta growth in object counts (specifically retained size).\n• Inspect Closures & Streams: Check if database connections, uncaught stream events, or unclosed timers are retaining memory."
  },
  {
    text: "How does garbage collection work in Node.js? Mark and Sweep?",
    category: "Memory & Debugging",
    difficulty: "Hard",
    answerDraft: "• Mark-Sweep: Node scans roots (global variables, call stack references) and marks all reachable objects. In the sweep phase, unmarked (unreachable) objects are deallocated from heap memory."
  },
  {
    text: "What is heapUsed, heapTotal, and RSS?",
    category: "Memory & Debugging",
    difficulty: "Medium",
    answerDraft: "• RSS (Resident Set Size): Total physical memory allocated to the node process (includes heap, code segment, stack, and dependencies).\n• heapTotal: Total memory allocated for Javascript objects.\n• heapUsed: Memory actually occupied by active Javascript objects."
  },

  // 7. Large File Processing
  {
    text: "How do you process a 100 GB CSV file?",
    category: "Large Files",
    difficulty: "Hard",
    answerDraft: "• Node Streams: Pipe file stream into a CSV parser (e.g. `csv-parser`). Parses row-by-row.\n• Memory Safety: Reading chunks keeps memory footprint constant (typically < 100MB RAM even for 100GB files).\n• Batch Upsert: Accumulate rows and execute bulk updates dynamically."
  },

  // 8. Python Internals
  {
    text: "What is __slots__ in Python?",
    category: "Python Internals",
    difficulty: "Hard",
    answerDraft: "• Definition: A special class attribute that tells Python to store attributes in a fixed array rather than creating a dynamic `__dict__` dictionary for every instance.\n• Benefit: Significantly reduces memory footprint (up to 50-70% less RAM) for classes with millions of instances."
  }
];

async function main() {
  console.log('Seeding interview questions into database...');

  // Find target user
  let user = await prisma.user.findUnique({
    where: { email: 'gangeshkr996@gmail.com' }
  });

  if (!user) {
    user = await prisma.user.findFirst();
  }

  if (!user) {
    // If no user exists, create a default user for Gangesh
    const hashedPassword = await bcrypt.hash('password123', 10);
    user = await prisma.user.create({
      data: {
        email: 'gangeshkr996@gmail.com',
        hashedPassword,
        fullName: 'Gangesh',
      },
    });
    console.log('Created default user gangeshkr996@gmail.com');
  }

  console.log(`Target user: ${user.email} (ID: ${user.id})`);

  // Clear existing questions for this user specifically, to prevent duplicates on re-run,
  // without affecting other candidates' questions.
  await prisma.revisionList.deleteMany({
    where: { userId: user.id }
  });
  await prisma.question.deleteMany({
    where: { userId: user.id }
  });

  // Note: we can keep skills or re-create them. Let's delete skills for this user to start clean.
  await prisma.skill.deleteMany({
    where: { userId: user.id }
  });

  for (const q of QUESTIONS_DATA) {
    await prisma.question.create({
      data: {
        userId: user.id,
        text: q.text,
        category: q.category,
        difficulty: q.difficulty,
        confidenceLevel: 5,
        needsRevision: true,
        answerDraft: q.answerDraft,
      }
    });
  }

  console.log(`Successfully seeded ${QUESTIONS_DATA.length} interview questions for ${user.email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
