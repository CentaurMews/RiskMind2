import https from "https";
import http from "http";

export interface OsintResult {
  source: string;
  success: boolean;
  data: Record<string, unknown>[];
  summary: string;
  error?: string;
}

interface HttpResponse {
  statusCode: number;
  body: string;
}

function httpGet(url: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.get({ hostname: parsed.hostname, port: parsed.port || undefined, path: parsed.pathname + parsed.search, headers }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Request timed out")); });
  });
}

function httpPost(url: string, body: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const postData = Buffer.from(body);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: { "Content-Length": postData.length, ...headers },
    };
    const req = mod.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("Request timed out")); });
    req.write(postData);
    req.end();
  });
}

function assertOk(response: HttpResponse, source: string): void {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    let detail = "";
    try {
      const parsed = JSON.parse(response.body) as Record<string, unknown>;
      detail = String(parsed.error || parsed.message || parsed.detail || "");
    } catch {
      detail = response.body.slice(0, 200);
    }
    throw new Error(`HTTP ${response.statusCode} from ${source}${detail ? `: ${detail}` : ""}`);
  }
}

export interface PerplexityCredentials {
  apiKey: string;
}

export async function runPerplexity(creds: PerplexityCredentials, query?: string): Promise<OsintResult> {
  const prompt = query || "What are the top cybersecurity threats, vulnerabilities, and incidents from the last 24 hours? Focus on critical CVEs, ransomware, supply chain attacks, and data breaches. Be concise and structured.";
  try {
    const body = JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    });
    const response = await httpPost("https://api.perplexity.ai/chat/completions", body, {
      "Authorization": `Bearer ${creds.apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    });
    assertOk(response, "Perplexity");
    const parsed = JSON.parse(response.body) as { choices?: Array<{ message?: { content?: string } }> };
    const content = parsed.choices?.[0]?.message?.content || "";
    if (!content) throw new Error("Empty response from Perplexity — invalid API key or quota exceeded");
    return {
      source: "perplexity",
      success: true,
      data: [{ content, query: prompt }],
      summary: `Perplexity threat intelligence retrieved (${content.length} chars)`,
    };
  } catch (err) {
    return { source: "perplexity", success: false, data: [], summary: "", error: err instanceof Error ? err.message : String(err) };
  }
}

export interface AlienVaultCredentials {
  apiKey: string;
}

export async function runAlienVaultOTX(creds: AlienVaultCredentials): Promise<OsintResult> {
  try {
    const response = await httpGet("https://otx.alienvault.com/api/v1/pulses/subscribed?limit=20&modified_since=1d", {
      "X-OTX-API-KEY": creds.apiKey,
    });
    assertOk(response, "AlienVault OTX");
    const parsed = JSON.parse(response.body) as { results?: Array<{ name?: string; description?: string; tags?: string[]; indicators?: unknown[] }> };
    if (!parsed.results) throw new Error("Unexpected AlienVault OTX response — invalid API key or quota exceeded");
    const pulses = parsed.results;
    const data = pulses.map((p) => ({
      name: p.name,
      description: p.description,
      tags: p.tags,
      indicatorCount: Array.isArray(p.indicators) ? p.indicators.length : 0,
    }));
    return {
      source: "alienvault_otx",
      success: true,
      data,
      summary: `AlienVault OTX: ${data.length} threat pulses retrieved`,
    };
  } catch (err) {
    return { source: "alienvault_otx", success: false, data: [], summary: "", error: err instanceof Error ? err.message : String(err) };
  }
}

export interface CensysCredentials {
  apiId: string;
  apiSecret: string;
}

export async function runCensys(creds: CensysCredentials, query?: string): Promise<OsintResult> {
  const searchQuery = query || "services.port: 22 OR services.port: 3389";
  try {
    const auth = Buffer.from(`${creds.apiId}:${creds.apiSecret}`).toString("base64");
    const body = JSON.stringify({ q: searchQuery, per_page: 20, fields: ["ip", "services", "location", "labels"] });
    const response = await httpPost("https://search.censys.io/api/v2/hosts/search", body, {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    });
    assertOk(response, "Censys");
    const parsed = JSON.parse(response.body) as { result?: { hits?: Array<{ ip?: string; services?: unknown[]; location?: unknown; labels?: unknown[] }> } };
    if (!parsed.result) throw new Error("Unexpected Censys response — invalid API credentials");
    const hits = parsed.result.hits || [];
    return {
      source: "censys",
      success: true,
      data: hits.map((h) => ({ ip: h.ip, serviceCount: Array.isArray(h.services) ? h.services.length : 0, labels: h.labels })),
      summary: `Censys: ${hits.length} hosts found for query "${searchQuery}"`,
    };
  } catch (err) {
    return { source: "censys", success: false, data: [], summary: "", error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runNvdCisa(): Promise<OsintResult> {
  try {
    const pubStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] + "T00:00:00.000";
    const [nvdResp, cisaResp] = await Promise.all([
      httpGet(`https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${pubStartDate}&resultsPerPage=20`),
      httpGet("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"),
    ]);

    assertOk(nvdResp, "NVD");
    assertOk(cisaResp, "CISA KEV");

    const nvd = JSON.parse(nvdResp.body) as { vulnerabilities?: Array<{ cve?: { id?: string; descriptions?: Array<{ lang?: string; value?: string }>; metrics?: unknown } }> };
    const cisa = JSON.parse(cisaResp.body) as { vulnerabilities?: Array<{ cveID?: string; vendorProject?: string; product?: string; vulnerabilityName?: string; dateAdded?: string }> };

    const nvdItems = (nvd.vulnerabilities || []).map((v) => ({
      cveId: v.cve?.id,
      description: v.cve?.descriptions?.find((d) => d.lang === "en")?.value?.slice(0, 200),
    }));

    const cisaItems = (cisa.vulnerabilities || []).slice(0, 20).map((v) => ({
      cveId: v.cveID,
      vendor: v.vendorProject,
      product: v.product,
      name: v.vulnerabilityName,
      dateAdded: v.dateAdded,
    }));

    return {
      source: "nvd_cisa",
      success: true,
      data: [{ nvdCves: nvdItems, cisaKev: cisaItems }],
      summary: `NVD: ${nvdItems.length} recent CVEs; CISA KEV: ${cisaItems.length} known exploited vulnerabilities`,
    };
  } catch (err) {
    return { source: "nvd_cisa", success: false, data: [], summary: "", error: err instanceof Error ? err.message : String(err) };
  }
}

export interface EmailImapCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  mailbox: string;
  smtpFromAddress?: string;
  smtpFromName?: string;
}

export async function runEmailImap(creds: EmailImapCredentials): Promise<OsintResult> {
  try {
    const Imap = (await import("imap")).default;
    const { simpleParser } = await import("mailparser");

    const emails: Array<{ subject: string; from: string; date: string; snippet: string }> = [];
    const useTls = creds.port === 993 || creds.port === 995;

    await new Promise<void>((resolve, reject) => {
      const imap = new Imap({
        user: creds.username,
        password: creds.password,
        host: creds.host,
        port: creds.port,
        tls: useTls,
        connTimeout: 10000,
        authTimeout: 5000,
      });

      imap.once("ready", () => {
        imap.openBox(creds.mailbox || "INBOX", false, (err) => {
          if (err) { imap.end(); reject(err); return; }
          imap.search(["UNSEEN"], (sErr, results) => {
            if (sErr || !results || results.length === 0) { imap.end(); resolve(); return; }
            const fetch = imap.fetch(results.slice(0, 10), { bodies: "" });
            const pending: Promise<void>[] = [];
            fetch.on("message", (msg) => {
              const p = new Promise<void>((msgResolve) => {
                let rawBuffer = "";
                msg.on("body", (stream) => {
                  stream.on("data", (chunk: Buffer) => (rawBuffer += chunk.toString("utf8")));
                  stream.once("end", async () => {
                    try {
                      const parsed = await simpleParser(rawBuffer);
                      emails.push({
                        subject: String(parsed.subject || ""),
                        from: String(parsed.from?.text || ""),
                        date: parsed.date?.toISOString() || "",
                        snippet: (parsed.text || "").slice(0, 500),
                      });
                    } catch {
                    }
                    msgResolve();
                  });
                });
              });
              pending.push(p);
            });
            fetch.once("end", async () => {
              await Promise.all(pending);
              imap.end();
              resolve();
            });
            fetch.once("error", (fErr: Error) => { imap.end(); reject(fErr); });
          });
        });
      });
      imap.once("error", reject);
      imap.connect();
    });

    return {
      source: "email_imap",
      success: true,
      data: emails.map((e) => ({ subject: e.subject, from: e.from, date: e.date, snippet: e.snippet })),
      summary: `Email IMAP: ${emails.length} unread threat emails retrieved from ${creds.mailbox || "INBOX"}`,
    };
  } catch (err) {
    return { source: "email_imap", success: false, data: [], summary: "", error: err instanceof Error ? err.message : String(err) };
  }
}
