Read `homepage-input.json`. For each item, find the specific press release or news story that matches the refs' title and date. Use the entity names to help identify the article.

Return only a JSON array with one object per input item, containing the input `hid` and the article `url`. Set `url` to null when you cannot verify a match.

Exclude the following hosts and all their subdomains:

- Pointer-only hosts — `thequantuminsider.com`, `quantumcomputingreport.com`.
- Blocklisted hosts — `linkedin.com`, `crunchbase.com`, `wikipedia.org`, `facebook.com`, `twitter.com`, `x.com`, `medium.com`, `prnewswire.com`, `globenewswire.com`, `businesswire.com`, `accessnewswire.com`, `finance.yahoo.com`.
