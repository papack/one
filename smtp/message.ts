import { randomUUID } from "node:crypto";
import type { SmtpSendInput } from "./types";

function header(value: string): string {
  // Reject header injection, including CR/LF and NUL.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new Error("Mail headers must not contain control characters");
  }
  return value;
}

// Deliberately accept only ASCII dot-atom addresses, optionally with a display name.
// International domains must be supplied as punycode; SMTPUTF8 is not required.
export function address(value: string): { mailbox: string; display: string } {
  header(value);
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(value);
  const mailbox = match ? match[2] : value;
  const parts = mailbox.split("@");
  if (
    parts.length !== 2 ||
    mailbox.length > 254 ||
    parts[0].length > 64 ||
    !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i.test(
      parts[0],
    ) ||
    !parts[1]
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  )
    throw new Error("Invalid email address");
  const name = match?.[1].trim().replace(/^"(.*)"$/, "$1");
  return { mailbox, display: name ? `${encoded(name)} <${mailbox}>` : mailbox };
}

function encoded(value: string): string {
  header(value);
  // Small encoded words keep UTF-8 code points intact and respect RFC 2047 limits.
  const chunks: string[] = [];
  let chunk = "";
  for (const character of value) {
    if (Buffer.byteLength(chunk + character) > 42) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks
    .map((part) => `=?UTF-8?B?${Buffer.from(part).toString("base64")}?=`)
    .join("\r\n ");
}

function base64(value: Buffer | string): string {
  return (
    Buffer.from(value)
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? ""
  );
}

function part(type: string, body: string): string {
  return `Content-Type: ${type}; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(body.replace(/\r\n|\r|\n/g, "\r\n"))}`;
}

function multipart(type: string, parts: string[]): string {
  const boundary = `one-${randomUUID()}`;
  return `Content-Type: multipart/${type}; boundary="${boundary}"\r\n\r\n${parts.map((value) => `--${boundary}\r\n${value}\r\n`).join("")}--${boundary}--`;
}

export function message(from: string, input: SmtpSendInput) {
  const sender = address(from);
  const to = (input.to ?? []).map(address);
  const cc = (input.cc ?? []).map(address);
  const bcc = (input.bcc ?? []).map(address);
  const recipients = [
    ...new Set([...to, ...cc, ...bcc].map((value) => value.mailbox)),
  ];
  if (!recipients.length) throw new Error("At least one recipient is required");
  if (input.html !== undefined && input.content !== undefined) {
    throw new Error("Provide either html or content, not both");
  }
  const html = input.html ?? input.content;
  if (input.text === undefined && html === undefined)
    throw new Error("Provide text or html");
  const parts: string[] = [];
  if (input.text !== undefined) parts.push(part("text/plain", input.text));
  if (html !== undefined) parts.push(part("text/html", html));
  let body = parts.length === 1 ? parts[0] : multipart("alternative", parts);
  if (input.attachments?.length) {
    body = multipart("mixed", [
      body,
      ...input.attachments.map((attachment) => {
        header(attachment.filename);
        if (
          !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(
            attachment.contentType,
          )
        ) {
          throw new Error("Invalid attachment content type");
        }
        // RFC 2231 continuations keep long and non-ASCII filenames interoperable.
        const filename = Array.from(attachment.filename).map((char) =>
          Array.from(Buffer.from(char))
            .map((byte) => `%${byte.toString(16).padStart(2, "0")}`)
            .join(""),
        );
        const segments: string[] = [""];
        for (const char of filename) {
          if (segments[segments.length - 1].length + char.length > 48)
            segments.push("");
          segments[segments.length - 1] += char;
        }
        const disposition = segments
          .map(
            (segment, index) =>
              `filename*${index}*=${index === 0 ? "utf-8''" : ""}${segment}`,
          )
          .join(";\r\n ");
        return `Content-Type: ${attachment.contentType}\r\nContent-Disposition: attachment;\r\n ${disposition}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(attachment.buffer)}`;
      }),
    ]);
  }
  const headers = [
    `From: ${sender.display}`,
    ...(to.length
      ? [`To: ${to.map((value) => value.display).join(",\r\n ")}`]
      : []),
    ...(cc.length
      ? [`Cc: ${cc.map((value) => value.display).join(",\r\n ")}`]
      : []),
    `Subject: ${encoded(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${sender.mailbox.split("@")[1]}>`,
    "MIME-Version: 1.0",
  ];
  return {
    sender: sender.mailbox,
    recipients,
    data: `${headers.join("\r\n")}\r\n${body}\r\n`,
  };
}
