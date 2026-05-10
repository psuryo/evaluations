-- CreateTable "student_final_grades"
CREATE TABLE "student_final_grades" (
    "id" SERIAL NOT NULL,
    "nrp" VARCHAR,
    "idkuliah" INTEGER,
    "mid_assignment_grade" DECIMAL(5,2),
    "mid_exam_grade" DECIMAL(5,2),
    "final_assignment_grade" DECIMAL(5,2),
    "final_exam_grade" DECIMAL(5,2),
    "final_grade" DECIMAL(5,2),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_final_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable "course_grade_weights"
CREATE TABLE "course_grade_weights" (
    "id" SERIAL NOT NULL,
    "idkuliah" INTEGER NOT NULL,
    "mid_assignment_weight" INTEGER NOT NULL DEFAULT 15,
    "mid_exam_weight" INTEGER NOT NULL DEFAULT 25,
    "final_assignment_weight" INTEGER NOT NULL DEFAULT 20,
    "final_exam_weight" INTEGER NOT NULL DEFAULT 40,

    CONSTRAINT "course_grade_weights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_final_grades_nrp_idkuliah_key" ON "student_final_grades"("nrp", "idkuliah");

-- CreateIndex
CREATE UNIQUE INDEX "course_grade_weights_idkuliah_key" ON "course_grade_weights"("idkuliah");
