# Crit 4 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was realising that tokens spent on planning are tokens I don't
spend later untangling a poor implementation. My earlier crits ended in a long
tail of undirected bug fixing, and the cause was the same each time: I started
building before deciding what the thing was. So this time I paid for the plan up
front, and used Opus to write it, because planning is where being wrong is most
expensive.

That split also taught me something about Sonnet I would not have learnt
prompting it freehand. Building one subsystem at a time against a plan it had
not written showed me clearly where it is strong and where it simply needs the
decision made for it. Most things I left unspecified still got decided, just by
the agent's default reading rather than by me. Knowing which model to point at
which kind of problem now feels like a real decision-making skill rather than a preference.

## What did this work change about who I want to be as a software developer?

Until this crit I had been using "context" and "tokens" interchangeably, and
this is the week I properly understood they are not the same thing. Tokens are
what I spend. Context is the working memory a session has, and it is mine to
manage. Moreover, I understood that token usage can get heavily compounded even with a slowly increasing context.

I did hit Opus's context limit while planning. My first instinct was to read it
as having done something wrong, but the more useful reading is that it was a
signal: I should have cleared before starting the next big task rather than
pushing on until the window ran out. I want to be the kind of developer who
treats that as ordinary scheduling rather than failure, and who decides where a
session ends instead of letting the limit decide it.
