CREATE TABLE "ClientReferenceSequence" (
    "id" TEXT NOT NULL DEFAULT 'client_reference_seed',
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientReferenceSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientName" TEXT,
    "companyName" TEXT,
    "companyEmail" TEXT,
    "companyWebsite" TEXT,
    "companyLogo" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_reference_key"
    ON "Client"("reference");

ALTER TABLE "Project"
ADD COLUMN "clientId" TEXT;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClientEmailLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "sentBy" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "messageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientEmailLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClientEmailLog"
ADD CONSTRAINT "ClientEmailLog_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientEmailLog"
ADD CONSTRAINT "ClientEmailLog_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ClientEmailLog_clientId_idx"
    ON "ClientEmailLog"("clientId");

CREATE INDEX "ClientEmailLog_projectId_idx"
    ON "ClientEmailLog"("projectId");
