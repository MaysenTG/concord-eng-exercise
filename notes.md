Problem statment:

concord employees csv == cases

Don't prioritize granted visas. Prioritize cases that are in flight 

Long in submitted might be a signal to check

Advisor wants to make progress quickly

O-1A - High important and high complexity

High profile completion rate can be easily and quickly actioned

DOn't view cases that aren't mine (not crucial)

RFE higher urgency than denial



Edited:
Can't edit after submit to government

Ensure petition is right before submission

Time limit from RFE to resubmission




Assumptions/decisions:

CSV tidy-up:
- Dates are **DD/MM/YYYY**; the one US-style date (`04/22/2026`) was flipped to `22/04/2026`.
- Names like `"Chen, Wei"` → **Wei Chen** (same person, simpler format).
- Status spelling fixed (`in progress`, `completed`, etc. → **In Progress** / **Completed**); **O1A** → **O-1A**; **US** → **USA** in locations.
- Blanks we inferred (would confirm with real data): Yuki’s email, **EMP-1033** for Pieter, **0%** completion on Not Started rows, advisors matched to company/dept peers.
- Did **not** invent case dates for Not Filed / Not Started; left duplicate **Wei Chen** rows as-is.


Prioritization score (higher score means more urgent):
RFE Issued: 80
In Review: 50
Filed: 40
Denied: 15
Withdrawn: 5
Not Filed / blank + ready to file: 60
Not Filed / blank + incomplete profile: 20–45 scaled by completion (higher % = quicker win)
Approved: 0


Would like to add but not enough time:
- Table sorting
- Remove expires at from column into warnings
- 