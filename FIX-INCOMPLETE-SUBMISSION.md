# Fix for Incomplete Submission Issue

## Problem
User submitted an evaluation without filling all criteria, then couldn't re-evaluate because the form showed "Evaluation submitted".

## Root Cause
In `app/evaluate/[idkuliah]/page.tsx`:
- `alreadySubmitted` is true when ALL criteria sum to 100
- If user submits incomplete data, the submission record exists but criteria don't sum to 100
- Next visit: form loads existing (incomplete) evaluations and allows editing
- BUT the logic might still block if we're checking for submission existence instead of completion

## Immediate Fix (Code Change)

### File: `app/evaluate/[idkuliah]/page.tsx`

Change the `alreadySubmitted` logic to allow re-editing of incomplete submissions:

```typescript
// OLD (around line 55-60):
let isComplete = false

if (peerNrps.length === 0) {
  isComplete = true
} else if (submission) {
  const evaluations = await prisma.evaluations.findMany({...})
  const allComplete = kriteriaList.every((k) => {...})
  isComplete = allComplete  // Only true if ALL criteria complete
}

return {
  alreadySubmitted: isComplete,  // This blocks re-editing!
  ...
}

// NEW:
let isComplete = false
let hasIncompleteSubmission = false

if (peerNrps.length === 0) {
  isComplete = true
} else if (submission) {
  const evaluations = await prisma.evaluations.findMany({...})
  const allComplete = kriteriaList.every((k) => {...})
  isComplete = allComplete
  hasIncompleteSubmission = !allComplete && evaluations.length > 0
}

return {
  alreadySubmitted: isComplete,
  hasIncompleteSubmission,  // NEW: pass this to form
  ...
}
```

### File: `app/evaluate/EvaluationForm.tsx`

Update the form to handle incomplete submissions:

```typescript
type Props = {
  alreadySubmitted: boolean
  hasIncompleteSubmission?: boolean  // NEW
  // ... other props
}

export default function EvaluationForm({
  alreadySubmitted,
  hasIncompleteSubmission,
  // ...
}: Props) {
  // ...
  
  // OLD:
  if (alreadySubmitted || status === "done") {
    return <div>Evaluation submitted</div>
  }
  
  // NEW:
  if (alreadySubmitted && status === "done") {
    return (
      <div className="ev-done">
        <div className="ev-done-icon">✓</div>
        <h2 className="ev-done-title">Evaluation submitted</h2>
        <p className="ev-done-sub">Your peer grades for this course have been recorded.</p>
      </div>
    )
  }
  
  if (alreadySubmitted && !hasIncompleteSubmission) {
    return <div>Evaluation submitted</div>
  }
  
  if (hasIncompleteSubmission) {
    console.log("❌ Incomplete submission detected - allowing re-edit")
    // Allow form to display below
  }
  
  // Form continues normally...
}
```

## Immediate Workaround (Database)

To fix a specific NRP's incomplete submission:

```sql
-- Check status
SELECT s.nrp, s.idkuliah, COUNT(e.id) as eval_count
FROM submission s
LEFT JOIN evaluations e ON s.nrp = e.evaluator_nrp AND s.idkuliah = e.idkuliah
WHERE s.nrp = 'STUDENT_NRP'
GROUP BY s.nrp, s.idkuliah;

-- Reset incomplete submission
DELETE FROM evaluations WHERE evaluator_nrp = 'STUDENT_NRP' AND idkuliah = COURSE_ID;
DELETE FROM submission WHERE nrp = 'STUDENT_NRP' AND idkuliah = COURSE_ID;
```

## Tools Provided

1. **check-nrp-status.ts**: Check evaluation status for a student
   ```bash
   npx ts-node check-nrp-status.ts 123456
   npx ts-node check-nrp-status.ts 123456 1
   ```

2. **fix-incomplete-submission.ts**: Reset incomplete submission
   ```bash
   npx ts-node fix-incomplete-submission.ts 123456 1
   ```

## Testing

After applying the code fix:
1. Create a test account
2. Start evaluation but don't complete all criteria
3. Click submit (should fail if all criteria not done, or save partial)
4. Verify you can re-enter the form to complete it
5. Submit with all criteria at 100
6. Verify "Evaluation submitted" shows only when truly complete
