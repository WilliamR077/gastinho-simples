

## Fix: admin-dashboard 500 Error

### Root Cause

Line 146 calls `adminClient.rpc("", {})` with an empty string — this is a leftover placeholder that causes the edge function to crash with a 500 error. Even though there's a `.catch()`, it may not properly catch the error depending on how the Supabase client handles an invalid RPC name.

### Fix

| Arquivo | Ação |
|---|---|
| `supabase/functions/admin-dashboard/index.ts` | Remove the broken `rpc("")` call on line 146 and the related dead-code comments (lines 144-149). The `userEmailMap` on line 149 stays. |

The fix is simply deleting lines 144-148 (the broken rpc call and associated comments). The `topExpenses` variable is never used anyway. Everything else in the function is correct.

