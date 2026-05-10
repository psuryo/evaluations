CREATE TABLE "student_final_grades" (
  "id" SERIAL PRIMARY KEY,
  "nrp" VARCHAR,
  "idkuliah" INTEGER,
  "mid_assignment_grade" DECIMAL(5, 2),
  "mid_exam_grade" DECIMAL(5, 2),
  "final_assignment_grade" DECIMAL(5, 2),
  "final_exam_grade" DECIMAL(5, 2),
  "final_grade" DECIMAL(5, 2),
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("nrp", "idkuliah")
);

CREATE TABLE "course_grade_weights" (
  "id" SERIAL PRIMARY KEY,
  "idkuliah" INTEGER UNIQUE,
  "mid_assignment_weight" INTEGER DEFAULT 15,
  "mid_exam_weight" INTEGER DEFAULT 25,
  "final_assignment_weight" INTEGER DEFAULT 20,
  "final_exam_weight" INTEGER DEFAULT 40
);