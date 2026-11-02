-- CreateTable
CREATE TABLE "kelompok_penilaian" (
    "id" SERIAL NOT NULL,
    "nama" VARCHAR NOT NULL,
    "keterangan" TEXT,
    "tahun" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kelompok_penilaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kelompok_tim" (
    "id" SERIAL NOT NULL,
    "penilaianId" INTEGER NOT NULL,
    "nama" VARCHAR NOT NULL,
    CONSTRAINT "kelompok_tim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kelompok_anggota" (
    "id" SERIAL NOT NULL,
    "timId" INTEGER NOT NULL,
    "penilaianId" INTEGER NOT NULL,
    "nrp" VARCHAR NOT NULL,
    CONSTRAINT "kelompok_anggota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kelompok_kriteria" (
    "id" SERIAL NOT NULL,
    "penilaianId" INTEGER NOT NULL,
    "nama" VARCHAR NOT NULL,
    "tipe" VARCHAR NOT NULL,
    "bobot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "kelompok_kriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kelompok_nilai_tim" (
    "id" SERIAL NOT NULL,
    "kriteriaId" INTEGER NOT NULL,
    "timId" INTEGER NOT NULL,
    "nilai" DOUBLE PRECISION,
    CONSTRAINT "kelompok_nilai_tim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kelompok_nilai_individu" (
    "id" SERIAL NOT NULL,
    "kriteriaId" INTEGER NOT NULL,
    "nrp" VARCHAR NOT NULL,
    "nilai" DOUBLE PRECISION,
    CONSTRAINT "kelompok_nilai_individu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kelompok_anggota_penilaianId_nrp_key" ON "kelompok_anggota"("penilaianId", "nrp");
CREATE UNIQUE INDEX "kelompok_nilai_tim_kriteriaId_timId_key" ON "kelompok_nilai_tim"("kriteriaId", "timId");
CREATE UNIQUE INDEX "kelompok_nilai_individu_kriteriaId_nrp_key" ON "kelompok_nilai_individu"("kriteriaId", "nrp");

-- AddForeignKey
ALTER TABLE "kelompok_tim" ADD CONSTRAINT "kelompok_tim_penilaianId_fkey" FOREIGN KEY ("penilaianId") REFERENCES "kelompok_penilaian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kelompok_anggota" ADD CONSTRAINT "kelompok_anggota_timId_fkey" FOREIGN KEY ("timId") REFERENCES "kelompok_tim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kelompok_anggota" ADD CONSTRAINT "kelompok_anggota_nrp_fkey" FOREIGN KEY ("nrp") REFERENCES "usernilai"("nrp") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "kelompok_kriteria" ADD CONSTRAINT "kelompok_kriteria_penilaianId_fkey" FOREIGN KEY ("penilaianId") REFERENCES "kelompok_penilaian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kelompok_nilai_tim" ADD CONSTRAINT "kelompok_nilai_tim_kriteriaId_fkey" FOREIGN KEY ("kriteriaId") REFERENCES "kelompok_kriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kelompok_nilai_tim" ADD CONSTRAINT "kelompok_nilai_tim_timId_fkey" FOREIGN KEY ("timId") REFERENCES "kelompok_tim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kelompok_nilai_individu" ADD CONSTRAINT "kelompok_nilai_individu_kriteriaId_fkey" FOREIGN KEY ("kriteriaId") REFERENCES "kelompok_kriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
