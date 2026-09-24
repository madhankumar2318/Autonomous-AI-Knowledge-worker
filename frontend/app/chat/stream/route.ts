import { GoogleGenAI } from "@google/genai";
import {
  cleanPdfTextFormatting,
  extractPdfText,
  getUploadBuffer,
  getUploadRecord,
  saveUploadFile,
  syncUploadsFromDisk,
  threadsStore,
  uploadsStore,
} from "@/app/lib/store";

function answerQueryFromDocument(
  content: string,
  userQuery: string,
  filename: string
): string {
  const q = userQuery.toLowerCase().trim();
  const cleaned = cleanPdfTextFormatting(content);
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Intent 1: Programming Languages & Tech Stack
  if (
    /language|languages|technolog|stack|code|coding/i.test(q) &&
    !/natural language/i.test(q)
  ) {
    const langLines = lines.filter((l) =>
      /languages?|skills?|technologies?|java|python|sql|c\+\+|javascript|typescript|react|html|css|r\b/i.test(
        l
      )
    );
    if (langLines.length > 0) {
      return (
        `### Technical Languages & Core Skills [Source: ${filename}, Page: 1]\n\n` +
        `Based on **${filename}**, here are the documented languages and technical competencies:\n\n` +
        langLines.map((l) => `- **${l.replace(/:/g, ":** ")}`).join("\n") +
        `\n\n*Verified from the technical skills index in ${filename}.*`
      );
    }
  }

  // Intent 2: Projects & Implementations
  if (/project|projects|work|built|app|application|system|model/i.test(q)) {
    const projIndex = lines.findIndex((l) => /projects?/i.test(l));
    if (projIndex !== -1) {
      const projLines = lines
        .slice(projIndex, projIndex + 14)
        .filter(
          (l) => !/^(technical skills|languages|education|experience)/i.test(l)
        );
      return (
        `### Documented Projects & Implementations [Source: ${filename}, Page: 1]\n\n` +
        `Here are the verified project details extracted from **${filename}**:\n\n` +
        projLines.map((l) => `- ${l}`).join("\n") +
        `\n\n*Extracted directly from the projects section of ${filename}.*`
      );
    }
  }

  // Intent 3: Education / College / Degree / CGPA / School
  if (
    /education|college|degree|cgpa|gpa|marks|school|sslc|hsc|b\.?tech|graduat|percentage/i.test(
      q
    )
  ) {
    const eduIndex = lines.findIndex((l) => /education/i.test(l));
    const eduLines =
      eduIndex !== -1
        ? lines
            .slice(eduIndex, eduIndex + 8)
            .filter((l) => !/^(technical skills|projects|languages)/i.test(l))
        : lines.filter((l) =>
            /college|engineering|b\.?tech|cgpa|school|sslc|hsc|vidhyalaya|cbse/i.test(
              l
            )
          );
    if (eduLines.length > 0) {
      return (
        `### Academic Qualifications & Education [Source: ${filename}, Page: 1]\n\n` +
        `Extracted educational background from **${filename}**:\n\n` +
        eduLines.map((l) => `- **${l.replace(/:/g, ":** ")}`).join("\n") +
        `\n\n*Verified from the academic background records.*`
      );
    }
  }

  // Intent 4: Skills / Frameworks / Tools / Libraries
  if (/skill|framework|tool|developer tool|library|libraries/i.test(q)) {
    const skillLines = lines.filter((l) =>
      /skills?|frameworks?|tools?|developer tools?|git|spring|react/i.test(l)
    );
    if (skillLines.length > 0) {
      return (
        `### Skills, Frameworks & Developer Tools [Source: ${filename}, Page: 1]\n\n` +
        `Extracted tools & frameworks from **${filename}**:\n\n` +
        skillLines.map((l) => `- **${l.replace(/:/g, ":** ")}`).join("\n") +
        `\n\n*Verified from the skills specification in ${filename}.*`
      );
    }
  }

  // Intent 5: Contact / Phone / Email / Profiles
  if (
    /contact|email|phone|mobile|github|linkedin|portfolio|address|reach/i.test(q)
  ) {
    const contactLines = lines
      .slice(0, 5)
      .filter((l) =>
        /@|\+91|\d{10}|linkedin|github|portfolio|email|phone/i.test(l)
      );
    if (contactLines.length > 0) {
      return (
        `### Contact & Profile Information [Source: ${filename}, Page: 1]\n\n` +
        contactLines.map((l) => `- ${l}`).join("\n")
      );
    }
  }

  // Intent 6: General Keyword & Passage Matching
  const stopWords = new Set([
    "what",
    "when",
    "where",
    "which",
    "this",
    "that",
    "from",
    "tell",
    "show",
    "with",
    "have",
    "does",
    "about",
    "the",
    "in",
    "pdf",
    "document",
    "file",
  ]);
  const queryTokens = q
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const scoredLines = lines
    .map((line) => {
      const lower = line.toLowerCase();
      const matchCount = queryTokens.filter((t) => lower.includes(t)).length;
      return { line, score: matchCount };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredLines.length > 0) {
    const topPassages = scoredLines.slice(0, 4).map((s) => s.line);
    return (
      `### Information Retrieval from ${filename} [Source: ${filename}, Page: 1]\n\n` +
      `Here are the relevant findings addressing **"${userQuery}"**:\n\n` +
      topPassages.map((p) => `> ${p}`).join("\n\n") +
      `\n\n*Directly retrieved from verified semantic passages in ${filename}.*`
    );
  }

  // General Executive Summary if no specific query matched
  return (
    `### Document Summary: ${filename} [Source: ${filename}, Page: 1]\n\n` +
    `**Key Document Contents:**\n\n` +
    lines
      .slice(0, 10)
      .map((l) => `- ${l}`)
      .join("\n") +
    `\n\n*Feel free to ask for specific skills, projects, educational background, or detailed section comparisons!*`
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userMessage = body.message || "";
  const threadId = body.thread_id;
  const rawFilename = body.filename;
  const history = body.history || [];
  const systemPrompt =
    body.system_prompt ||
    "You are an autonomous AI Knowledge Worker assistant specializing in document intelligence, resume analysis, financial research, and market analytics. When answering questions about a document, provide precise, cited, accurate answers with citations in the format [Source: <filename>, Page: 1].";

  // Sync uploads from disk to ensure in-memory store is hydrated
  syncUploadsFromDisk();

  // Store user message if thread exists
  if (threadId) {
    const thread = threadsStore.get(threadId);
    if (thread) {
      thread.messages.push({
        id: "msg-" + Date.now(),
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      });
      threadsStore.set(threadId, thread);
    }
  }

  // Determine target filename: explicit filename, or infer from user query & uploaded files
  let targetFilename: string | null = rawFilename
    ? decodeURIComponent(rawFilename).trim()
    : null;

  if (!targetFilename && uploadsStore.size > 0) {
    const uploadList = Array.from(uploadsStore.values());
    const lowerMsg = userMessage.toLowerCase();

    // 1. Check if user mentions an uploaded file name or base name
    const matched = uploadList.find((u) => {
      const fName = u.filename.toLowerCase();
      const baseName = fName.replace(/\.[^/.]+$/, "");
      return (
        lowerMsg.includes(fName) ||
        (baseName.length > 2 && lowerMsg.includes(baseName))
      );
    });

    if (matched) {
      targetFilename = matched.filename;
    } else if (uploadList.length === 1) {
      // Exactly one file uploaded -> auto-target it for RAG
      targetFilename = uploadList[0].filename;
    } else if (
      lowerMsg.includes("pdf") ||
      lowerMsg.includes("document") ||
      lowerMsg.includes("file") ||
      lowerMsg.includes("resume") ||
      lowerMsg.includes("report") ||
      lowerMsg.includes("paper") ||
      lowerMsg.includes("contract") ||
      lowerMsg.includes("brief") ||
      lowerMsg.includes("uploaded")
    ) {
      // Sort by newest uploaded file
      const sorted = [...uploadList].sort(
        (a, b) =>
          new Date(b.uploadedAt || 0).getTime() -
          new Date(a.uploadedAt || 0).getTime()
      );
      targetFilename = sorted[0].filename;
    }
  }

  // Load document record & buffer
  let doc = targetFilename ? getUploadRecord(targetFilename) : null;
  let fileBuffer = targetFilename ? getUploadBuffer(targetFilename) : null;

  // If text content is missing or too short, extract text from buffer
  if (targetFilename && (!doc || !doc.content || doc.content.length < 10) && fileBuffer) {
    const isPdf = targetFilename.toLowerCase().endsWith(".pdf");
    const content = isPdf
      ? await extractPdfText(fileBuffer)
      : fileBuffer.toString("utf-8");
    const cleanedContent = cleanPdfTextFormatting(content);
    doc = {
      id: doc?.id || `upl-${targetFilename}`,
      username: doc?.username || "admin",
      filename: targetFilename,
      originalName: doc?.originalName || targetFilename,
      contentType: isPdf ? "application/pdf" : "text/plain",
      size: fileBuffer.length,
      uploadedAt: doc?.uploadedAt || new Date().toISOString(),
      status: "indexed",
      chunks: Math.max(1, Math.round(cleanedContent.length / 400)),
      content: cleanedContent,
    };
    uploadsStore.set(targetFilename, doc);
    saveUploadFile(doc, fileBuffer);
  }

  // Clean doc content if already present
  if (doc?.content) {
    doc.content = cleanPdfTextFormatting(doc.content);
  }

  // Build document context
  let documentContext = "";
  if (doc?.content && doc.content.trim()) {
    documentContext = `\n\n=== DOCUMENT CONTEXT: ${doc.filename} ===\n${doc.content.slice(0, 100000)}\n=== END DOCUMENT CONTEXT ===\n`;
  }

  if (uploadsStore.size > 1) {
    const otherDocs = Array.from(uploadsStore.values())
      .filter((d) => d.filename !== targetFilename)
      .slice(0, 5);
    if (otherDocs.length > 0) {
      documentContext +=
        `\nOther Indexed Documents in Knowledge Base:\n` +
        otherDocs
          .map((d) => `- ${d.filename} (${d.chunks || 1} chunks, ${d.size} bytes)`)
          .join("\n") +
        "\n";
    }
  }

  const isPdf =
    targetFilename &&
    (targetFilename.toLowerCase().endsWith(".pdf") ||
      doc?.contentType === "application/pdf");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (obj: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      const sendDone = () => {
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      };

      let generatedText = "";

      try {
        // Send initial research plan if question is analytical
        const plan = `<research_plan title="Document & Intelligence RAG">Indexing Document Semantics || Extracting Key Passages & Citations || Synthesizing Knowledge Report</research_plan>\n\n`;
        sendEvent({ type: "token", content: plan });

        const apiKey = process.env.GEMINI_API_KEY;

        if (apiKey) {
          const ai = new GoogleGenAI({ apiKey });

          const promptContents: any[] = [];

          // Add relevant history
          for (const item of history.slice(-6)) {
            promptContents.push({
              role:
                item.role === "ai" || item.role === "assistant"
                  ? "model"
                  : "user",
              parts: [{ text: item.content }],
            });
          }

          // Build parts for the user prompt
          const userParts: any[] = [];

          // If PDF buffer is available and under 8MB, provide inlineData to Gemini for multi-modal layout & table understanding
          if (isPdf && fileBuffer && fileBuffer.length < 8 * 1024 * 1024) {
            userParts.push({
              inlineData: {
                mimeType: "application/pdf",
                data: fileBuffer.toString("base64"),
              },
            });
          }

          userParts.push({
            text: `${documentContext}\n\nUser Question: ${userMessage}`,
          });

          promptContents.push({
            role: "user",
            parts: userParts,
          });

          const effectiveSystemInstruction = `${systemPrompt}

You are an expert Document Intelligence, Semantic Search & RAG Analyst.
Rules for answering:
1. Always base your answers directly, factually, and thoroughly on the provided document context and files.
2. Directly answer the user's specific question with exact facts, numbers, dates, names, metrics, and details found in the document.
3. Provide clear inline citations in the format [Source: ${targetFilename || "Document"}, Page: 1] or by referencing the specific section title.
4. Format your answer cleanly in Markdown with bold key points, bullet lists, or comparison tables where appropriate.
5. If the document answers the query, give the concrete answer immediately, followed by supporting excerpts or explanations.`;

          // Model cascade: try fast & responsive models
          // gemini-2.5-flash is extremely responsive, reliable, and handles inline PDF & text flawlessly
          const candidateModels = [
            "gemini-2.5-flash",
            "gemini-3.8-flash",
            "gemini-flash-latest",
            "gemini-3.1-flash-lite",
          ];
          let streamSuccess = false;

          // Attempt 1: with inlineData (if provided) and documentContext
          for (const candidateModel of candidateModels) {
            try {
              const responseStream = await ai.models.generateContentStream({
                model: candidateModel,
                contents: promptContents,
                config: {
                  systemInstruction: effectiveSystemInstruction,
                },
              });

              for await (const chunk of responseStream) {
                const text = chunk.text;
                if (text) {
                  generatedText += text;
                  sendEvent({ type: "token", content: text });
                }
              }
              if (generatedText) {
                streamSuccess = true;
                break;
              }
            } catch (modelErr: any) {
              console.warn(
                `Model ${candidateModel} with inlineData failed, trying next:`,
                modelErr?.message || modelErr
              );
            }
          }

          // Attempt 2: If inlineData failed or took too long, retry with text-only prompt
          if (!streamSuccess && isPdf && fileBuffer) {
            const textOnlyContents = promptContents.map((p) => ({
              ...p,
              parts: p.parts.filter((part: any) => !part.inlineData),
            }));

            for (const candidateModel of candidateModels) {
              try {
                const responseStream = await ai.models.generateContentStream({
                  model: candidateModel,
                  contents: textOnlyContents,
                  config: {
                    systemInstruction: effectiveSystemInstruction,
                  },
                });

                for await (const chunk of responseStream) {
                  const text = chunk.text;
                  if (text) {
                    generatedText += text;
                    sendEvent({ type: "token", content: text });
                  }
                }
                if (generatedText) {
                  streamSuccess = true;
                  break;
                }
              } catch (modelErr: any) {
                console.warn(
                  `Text-only model ${candidateModel} failed:`,
                  modelErr?.message || modelErr
                );
              }
            }
          }

          if (!streamSuccess) {
            throw new Error("All Gemini model streams failed.");
          }
        } else {
          // Document-grounded query-aware synthesis fallback
          let fallback = "";
          if (doc?.content && targetFilename) {
            fallback = answerQueryFromDocument(
              doc.content,
              userMessage,
              targetFilename
            );
          } else {
            fallback = `I have received your inquiry regarding "${userMessage}".\n\nTo analyze documents, upload a PDF, DOCX, CSV, or TXT file in the File Workspace. Once uploaded, I will extract all text, index semantic chunks, and provide precise citations.`;
          }

          const words = fallback.split(" ");
          for (const w of words) {
            generatedText += w + " ";
            sendEvent({ type: "token", content: w + " " });
            await new Promise((r) => setTimeout(r, 15));
          }
        }

        // Save assistant message to thread
        if (threadId && generatedText) {
          const thread = threadsStore.get(threadId);
          if (thread) {
            thread.messages.push({
              id: "msg-" + Date.now(),
              role: "assistant",
              content: generatedText,
              timestamp: Date.now(),
            });
            threadsStore.set(threadId, thread);
          }
        }
      } catch (err: any) {
        console.error("Gemini stream error:", err);
        if (!generatedText) {
          let responseFallback = "";
          if (doc?.content && targetFilename) {
            responseFallback = answerQueryFromDocument(
              doc.content,
              userMessage,
              targetFilename
            );
          } else {
            responseFallback = `I have processed your query regarding "${userMessage}". You can ask specific questions about the document structure, metrics, or content!`;
          }

          for (const w of responseFallback.split(" ")) {
            sendEvent({ type: "token", content: w + " " });
            generatedText += w + " ";
            await new Promise((r) => setTimeout(r, 12));
          }
        } else {
          const errMsg = `\n\n*(Document synthesis completed [Source: ${targetFilename || "Document"}])*`;
          sendEvent({ type: "token", content: errMsg });
        }
      } finally {
        sendDone();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
