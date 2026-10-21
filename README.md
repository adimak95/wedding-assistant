# Sofía & Rohan — wedding guest assistant

A chat bubble for sofiayrohan.com that answers guests' questions about the celebration in Delhi. It replies in the guest's language (Spanish or English), answers wedding questions only from `knowledge/knowledge.md`, searches the web for general India travel questions, and shows the planner's outfit guides when guests ask what to wear.

```
api/chat.js            the backend: calls Claude with the knowledge base + web search
api/_prompt.js         tone and rules (edit to change how the bot talks)
knowledge/knowledge.md the facts (edit to change what the bot knows)
public/widget.js       the chat bubble you add to WordPress
public/index.html      a preview page with the chat open (for showing the couple)
public/images/         the planner's outfit guides
scripts/ask.js         ask the bot a question from your terminal
```

Setup takes about an hour. You need three free accounts: Claude Console (pay as you go), GitHub and Vercel.

## 1. Get a Claude API key and cap the spend

1. Sign up at https://platform.claude.com and add a small amount of credit (USD 20 is plenty to start).
2. In the Console settings, set a **monthly spend limit** (for example USD 30). This is the real safety net: the bot stops answering if it's reached, instead of running up a bill.
3. Create an **API key** and copy it somewhere safe. You'll paste it into Vercel in step 3. Never put it in the code or in WordPress.

## 2. Put the code on GitHub

1. Create a new **private** repository on https://github.com (e.g. `wedding-assistant`).
2. Upload the contents of this folder (drag the files and folders into "Add file → Upload files"), or push with git.

## 3. Deploy on Vercel

1. Sign in to https://vercel.com with GitHub and choose **Add New → Project**, then import the repository.
2. Framework preset: **Other**. Leave the build settings empty.
3. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your key from step 1
   - `ALLOWED_ORIGINS` = `https://sofiayrohan.com,https://www.sofiayrohan.com` (already the default; add any other domain the site uses)
4. Click **Deploy**. You get an address like `https://wedding-assistant-xyz.vercel.app`.
5. Open that address: it's the preview page with the chat open. Ask it a few questions. This is the link to show the couple before touching their website.

## 4. Add the chat to the WordPress site

You need admin access to the WordPress site.

1. Install the free plugin **WPCode** (Plugins → Add New → search "WPCode").
2. In **Code Snippets → Header & Footer**, paste this into the **Footer** box and save:

   ```html
   <script src="https://YOUR-APP.vercel.app/widget.js" defer></script>
   ```

   Replace `YOUR-APP` with your Vercel address.
3. Open the site: the "¿Dudas del viaje?" button appears bottom-right.

Options on the script tag: `data-accent="#8c1c2c"` changes the colour to match the site; `data-lang="es"` forces Spanish (default is the visitor's browser language).

## 5. Updating what the bot knows

**Simple way:** edit `knowledge/knowledge.md` on GitHub (open the file, click the pencil, commit). Vercel redeploys automatically in about a minute.

**Google Doc way** (so the couple or planner can edit without GitHub):

1. Put the knowledge base in a Google Doc and share it as "Anyone with the link can view".
2. In Vercel, add the environment variable `KNOWLEDGE_URL` = `https://docs.google.com/document/d/DOC_ID/export?format=txt` (use the ID from the doc's address).
3. Redeploy once. After that, edits to the doc reach the bot within about 5 minutes. If the doc can't be read, the bot falls back to `knowledge/knowledge.md`.

Keep the "Not confirmed yet" list at the bottom up to date: anything on it, the bot says it doesn't know and sends guests to the planner.

## 6. Seeing what guests ask

In Vercel, open the project → **Logs** and search for `"event":"chat"`. Each line shows the question, token use and whether it searched the web. Visitor IPs aren't logged. Questions the bot couldn't answer are your to-do list for the knowledge base.

## Costs

The bot uses Claude Sonnet 5.5 at low effort, with the knowledge base cached between requests. A typical answer costs roughly 1–2 US cents; one that searches the web, a few cents more (searches are USD 10 per 1,000 plus the extra reading). A few hundred questions should stay well under USD 20. Check real usage in the Console after the first days.

Built-in limits: 30 questions per visitor per hour, 800 characters per message, the last 12 messages of a conversation, and at most 3 web searches per answer. Change them with the `RATE_LIMIT_PER_HOUR` and `MAX_SEARCHES` environment variables.

## Testing from your terminal

With Node 20+:

```sh
ANTHROPIC_API_KEY=sk-ant-... node scripts/ask.js "¿Qué visa necesito?"
```

This is also the starting point for evals later.
