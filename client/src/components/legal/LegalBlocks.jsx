import React from "react";

/**
 * Renders structured legal blocks (paragraphs, lists, links, contact block).
 */
export default function LegalBlocks({ blocks }) {
  if (!blocks?.length) return null;
  return blocks.map((b, i) => {
    if (b.type === "p") {
      return <p key={i}>{b.text}</p>;
    }
    if (b.type === "ul") {
      return (
        <ul key={i}>
          {b.items.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      );
    }
    if (b.type === "p_link") {
      return (
        <p key={i}>
          {b.before}
          <a href={b.href} target="_blank" rel="noopener noreferrer">
            {b.linkText}
          </a>
          {b.after}
        </p>
      );
    }
    if (b.type === "dl") {
      return (
        <dl key={i} className="legal__list">
          {b.items.map((row, idx) => (
            <React.Fragment key={idx}>
              <dt>{row.dt}</dt>
              <dd>
                {row.href ? (
                  <a href={row.href}>{row.dd}</a>
                ) : (
                  row.dd
                )}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      );
    }
    if (b.type === "address") {
      return (
        <address key={i} className="legal__address">
          {b.lineStrong ? (
            <>
              <strong>{b.lineStrong}</strong>
              <br />
            </>
          ) : null}
          {b.lines?.map((line, li) => (
            <React.Fragment key={li}>
              {line}
              <br />
            </React.Fragment>
          ))}
        </address>
      );
    }
    if (b.type === "richContact") {
      return (
        <React.Fragment key={i}>
          <p>{b.intro}</p>
          <p>
            <strong>{b.emailLabel}</strong>{" "}
            <a href="mailto:support@medscoutx.app">support@medscoutx.app</a>
            <br />
            <strong>{b.phoneLabel}</strong>{" "}
            <a href="tel:+4921115895272">+49 211 15895272</a>
          </p>
          <p>
            {b.noteBefore}
            <strong>{b.noteStrong}</strong>
            {b.noteAfter}
          </p>
        </React.Fragment>
      );
    }
    if (b.type === "html") {
      return (
        <div
          key={i}
          className={b.className || "legal__html-block"}
          dangerouslySetInnerHTML={{ __html: b.html }}
        />
      );
    }
    return null;
  });
}
