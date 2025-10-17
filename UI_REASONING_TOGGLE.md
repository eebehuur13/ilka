# Reasoning Toggle UI Implementation

## What Changed

### 1. **Model Selector Moved to Chat Input** (Option 1 - ChatGPT Style)

**Before**: Fast/Reasoning toggle was beside Model-Only/File-Search in header

**After**: Professional dropdown above textarea (only in Model-Only mode)

```
Model-Only Mode:
┌──────────────────────────────────────┐
│ [⚡ Fast ▾]                          │  ← Dropdown selector
│ ┌──────────────────────────────────┐ │
│ │ Ask me anything...               │ │
│ └──────────────────────────────────┘ │
│                          [Send]      │
└──────────────────────────────────────┘

File-Search Mode:
(No selector - uses fast mode automatically)
```

**Dropdown Options**:
- ⚡ **Fast** - Quick responses (thinkingBudget=0)
- 🧠 **Reasoning** - Deep thinking (thinkingBudget=-1, dynamic)

### 2. **Improved Answer Formatting**

Fixed ReactMarkdown rendering with custom components:

**Typography**:
- Paragraphs: `mb-4` spacing, `leading-relaxed`, `last:mb-0`
- Headings: Proper margins (`mt-6/5/4`, `mb-3/2`), `first:mt-0`
- Lists: `list-disc/decimal`, proper spacing (`space-y-1`)
- List items: `leading-relaxed`

**Code Blocks**:
- Inline: `bg-gray-100 px-1.5 py-0.5 rounded font-mono`
- Block: `bg-gray-100 p-3 rounded-md mb-4 font-mono overflow-x-auto`
- Detection: Uses `node.position` to determine inline vs block

**Blockquotes**:
- `border-l-4 border-gray-300 pl-4 italic text-gray-700`

### 3. **Debug Logging Added**

To verify reasoning toggle works:

```typescript
// In handlers.ts
console.log('[DEBUG] Query received:', { query, mode, reasoning });
console.log('[DEBUG] Model-only stream - thinkingBudget:', thinkingBudget, 'reasoning:', reasoning);
console.log('[DEBUG] Model-only non-stream - thinkingBudget:', thinkingBudget, 'reasoning:', reasoning);
```

Check browser console and worker logs to confirm:
- `reasoning: true` → `thinkingBudget: -1`
- `reasoning: false` → `thinkingBudget: 0`

## Files Modified

1. **ui/src/components/layout/Header.tsx** - Removed Fast/Reasoning toggle
2. **ui/src/components/ui/dropdown.tsx** - NEW reusable dropdown component
3. **ui/src/components/chat/ChatInput.tsx** - Added model selector above textarea
4. **ui/src/components/chat/ChatMessage.tsx** - Custom ReactMarkdown components for formatting
5. **src/api/handlers.ts** - Debug logging for reasoning parameter

## How to Test Reasoning Mode

### 1. **Check Debug Logs**

Open browser console and ask a question:
- **Fast mode**: Should see `thinkingBudget: 0`
- **Reasoning mode**: Should see `thinkingBudget: -1`

### 2. **Test with Complex Questions**

Simple questions may not trigger thinking even with reasoning enabled (Gemini decides).

**Good test questions** (likely to trigger thinking):
- "Explain step by step why quantum entanglement doesn't violate causality"
- "What is 847 × 963? Show your work step by step"
- "Compare and contrast utilitarianism vs deontological ethics, with examples"
- "Prove that the square root of 2 is irrational"

**What to expect**:
- **Fast mode**: Direct answer, no thinking section
- **Reasoning mode**: May show "Show thinking process" toggle with chain-of-thought

### 3. **Check Gemini Response**

If reasoning mode enabled but no thinking shown:
- Question was too simple for Gemini to use thinking
- Gemini has autonomy to decide when thinking is needed
- Even with `thinkingBudget=-1`, simple factual queries may skip thinking

## Deployment URLs

- **Worker**: https://ilka.eebehuur13.workers.dev
- **UI**: https://9d99ecec.ilka-ui.pages.dev

## Troubleshooting

**Issue**: "No thinking shown even with Reasoning mode"
- **Solution**: Try harder questions (math, logic, complex reasoning)
- **Check**: Browser console shows `thinkingBudget: -1`?
- **Note**: Gemini decides when to use thinking, not all queries trigger it

**Issue**: "Dropdown not showing"
- **Solution**: Make sure you're in Model-Only mode (not File-Search)

**Issue**: "Formatting still looks off"
- **Solution**: Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)
- **Check**: New CSS bundle loaded?

## Next Steps

1. Test reasoning mode with complex questions
2. Monitor worker logs for debug output
3. Verify Gemini API usage/costs in Google Cloud Console
4. Consider removing debug logs after verification
