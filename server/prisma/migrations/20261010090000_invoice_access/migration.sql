ALTER TABLE "Invoice" ADD COLUMN "accessToken" TEXT;
UPDATE "Invoice" SET "accessToken" = gen_random_uuid()::text;
ALTER TABLE "Invoice" ALTER COLUMN "accessToken" SET NOT NULL;
CREATE UNIQUE INDEX "Invoice_accessToken_key" ON "Invoice"("accessToken");
