CREATE TYPE "EmailMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "EmailMessageStatus" AS ENUM ('RECEIVED', 'SENT', 'FAILED', 'QUEUED');

CREATE TABLE "EmailConversation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailConversation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmailConversation"
ADD CONSTRAINT "EmailConversation_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailConversation"
ADD CONSTRAINT "EmailConversation_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "direction" "EmailMessageDirection" NOT NULL DEFAULT 'INBOUND',
    "senderEmail" TEXT,
    "recipientEmail" TEXT,
    "subject" TEXT,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'RESEND',
    "providerMessageId" TEXT,
    "messageIdHeader" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "status" "EmailMessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmailMessage"
ADD CONSTRAINT "EmailMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "EmailConversation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailMessage"
ADD CONSTRAINT "EmailMessage_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailMessage"
ADD CONSTRAINT "EmailMessage_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "EmailMessage_provider_providerMessageId_key"
    ON "EmailMessage"("provider", "providerMessageId");

CREATE INDEX "EmailMessage_conversationId_createdAt_idx"
    ON "EmailMessage"("conversationId", "createdAt");

CREATE INDEX "EmailMessage_clientId_createdAt_idx"
    ON "EmailMessage"("clientId", "createdAt");

CREATE INDEX "EmailMessage_providerMessageId_idx"
    ON "EmailMessage"("providerMessageId");

CREATE INDEX "EmailConversation_clientId_updatedAt_idx"
    ON "EmailConversation"("clientId", "updatedAt");

CREATE INDEX "EmailConversation_projectId_updatedAt_idx"
    ON "EmailConversation"("projectId", "updatedAt");
