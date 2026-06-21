import React, { useEffect, useState } from "react";
import { Building2, UserRound } from "lucide-react";

/**
 * Presentational account avatar.
 *
 * Render priority: profile image / practice logo → normalized initials →
 * a role icon (so the control is never empty and never crashes).
 * Pure visual — the parent owns the surrounding <button> semantics and aria.
 *
 * @param {object} props
 * @param {string} [props.image]    Image URL (patient photo / practice logo).
 * @param {string} [props.alt]      Alt text for the image.
 * @param {string} [props.initials] Pre-computed, normalized initials.
 * @param {boolean} [props.isPractice]
 * @param {"md"|"lg"} [props.size]
 * @param {string} [props.className]
 */
export default function AccountAvatar({
  image = "",
  alt = "",
  initials = "",
  isPractice = false,
  size = "md",
  className = "",
}) {
  const [imageFailed, setImageFailed] = useState(false);

  // Reset the error state when the source changes.
  useEffect(() => {
    setImageFailed(false);
  }, [image]);

  const showImage = Boolean(image) && !imageFailed;
  const classes = [
    "ms-avatar",
    `ms-avatar--${size}`,
    isPractice ? "ms-avatar--practice" : "ms-avatar--patient",
    showImage ? "ms-avatar--image" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (showImage) {
    return (
      <span className={classes}>
        <img
          src={image}
          alt={alt}
          className="ms-avatar__img"
          onError={() => setImageFailed(true)}
          draggable={false}
        />
      </span>
    );
  }

  if (initials) {
    return (
      <span className={classes} aria-hidden="true">
        <span className="ms-avatar__initials">{initials}</span>
      </span>
    );
  }

  const FallbackIcon = isPractice ? Building2 : UserRound;
  return (
    <span className={classes} aria-hidden="true">
      <FallbackIcon
        size={size === "lg" ? 24 : 20}
        strokeWidth={2}
        aria-hidden="true"
      />
    </span>
  );
}
