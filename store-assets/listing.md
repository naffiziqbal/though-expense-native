# ThoughtExpense — Google Play listing kit

Everything to fill in Play Console → Store presence. Assets in this folder;
source HTML for the images in `src/` (edit + re-render with headless Chrome).

## Assets

| File | Use | Spec |
|---|---|---|
| `play-icon-512.png` | App icon (teal + white mark) | 512×512 PNG |
| `play-icon-512-white.png` | App icon (white + black mark) | 512×512 PNG |
| `feature-graphic.png` | Feature graphic | 1024×500 PNG |
| `screenshot-01-brand.png` … `06-expenses.png` | Phone screenshots (in order) | 1080×2400 PNG |

## App details

- **App name** (30 max): `ThoughtExpense`
- **Category:** Finance · **Free**, contains in-app purchases (subscription)
- **Tags:** expense tracker, budget, personal finance

**Short description** (80 max, 78 used):

```
Track expenses by typing naturally. AI parses, categorizes & budgets for you.
```

**Full description** (4000 max):

```
Stop filling out forms. Just type your spending the way you'd say it — "coffee 120, uber 250 and groceries 900" — and ThoughtExpense logs every item, categorized and dated, in one tap.

SAY IT. WE TRACK IT.
• Natural-language logging: one line can hold many expenses; AI splits, prices and categorizes each one
• Smart categories that learn from your corrections
• Multi-currency support (USD, EUR, GBP, BDT, INR, PKR, JPY, CAD, AUD)

SEE WHERE IT GOES
• A calm home screen: monthly total, budget health, top category, recent activity
• Spending analysis with category breakdowns and AI observations that actually say something
• Ask in plain language: "coffee last month", "anything over 500" — search understands meaning, not just words
• Full expense history with filters by category and date

ASK YOUR MONEY ANYTHING
• "Why did I spend so much this month?" — the AI advisor answers from YOUR real history
• "How can I save 20,000 next month?" — get a realistic plan built from your actual spending
• Smart alerts catch unusual spending, rising categories and quiet money leaks
• A weekly financial briefing lands every Monday: what you spent, what changed, what to do next

BUDGETS, GOALS & LIMITS
• Set a monthly limit, or type "Food 500, Rent 2000, Gas 100" and let AI build category budgets
• Savings goals with progress tracking — an emergency fund, a trip, a new phone
• Progress bars, safe-to-spend, and alerts before you overshoot

PREMIUM ($6.99/month, $60/year, or $99 once for lifetime)
• Unlimited AI advisor questions (free accounts get 5/month)
• Weekly financial briefing by email
• Smart alerts across 12 months of history
• Receipt scanning — snap a photo, AI extracts every line item
• Full history (free accounts see the last 3 months)
• Export to CSV or PDF

YOUR DATA, YOUR CALL
• Password reset by email code
• Delete your account and all data anytime, in-app or at https://thought-expense.nafiziqbal.com/account-deletion

Questions? thoughtexpense@nafiziqbal.com
```

## URLs for Play Console

- **Privacy policy:** https://thought-expense.nafiziqbal.com/privacy
- **Account deletion (Data safety → account deletion):** https://thought-expense.nafiziqbal.com/account-deletion
- **Support email:** thoughtexpense@nafiziqbal.com
- **Website:** https://thought-expense.nafiziqbal.com

## Data safety form (declare)

Collected, linked to identity, encrypted in transit; deletion available:
- **Personal info:** email address, name (account management)
- **Financial info:** user payment info NOT collected by app (Play handles it); "purchase history" = expense entries the user types (app functionality)
- **Photos:** receipt images (app functionality — processed for text extraction; avatar stored)
- No data sold; no third-party ad SDKs; no location.

## Content rating questionnaire

Finance app, no user-generated public content, no ads, no violence/gambling —
expect **Everyone**.

## Release notes (first release)

```
• Log expenses in plain language — AI parses and categorizes
• AI advisor: ask why spending changed and how to save
• Weekly financial briefing + smart spending alerts
• Savings goals, monthly budgets and AI category budgets
• Premium: receipt scanning, full history, CSV/PDF export
```

## Remaining Play checklist

1. Merchant account (required before the subscription products can exist)
2. Switch build to .aab (`eas.json`: remove `"buildType": "apk"` from production) and rebuild
3. Data safety + content rating forms (answers above)
4. If the developer account is a new personal account: closed test, 12 testers, 14 days
5. Create the `premium` entitlement products + RevenueCat wiring (see repo README):
   monthly subscription $6.99, yearly subscription $60, and a $99 lifetime
   one-time (non-consumable) product — attach all three to the `premium`
   entitlement and the default offering (package types MONTHLY / ANNUAL / LIFETIME)

## Re-rendering images

```bash
cd store-assets
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1080,2400 --virtual-time-budget=12000 \
  --screenshot=screenshot-02-home.png "file://$PWD/src/02-home.html"

# Play icon (512×512)
"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=512,512 --virtual-time-budget=8000 \
  --screenshot=play-icon-512-white.png "file://$PWD/src/play-icon-512-white.html"
```
