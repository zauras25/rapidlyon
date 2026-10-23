type SectionHeadingProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  level?: "h1" | "h2";
  tone?: "light" | "dark";
  className?: string;
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  level = "h2",
  tone = "light",
  className = "",
}: SectionHeadingProps) {
  const Heading = level;
  const headingColor = tone === "dark" ? "text-paper" : "text-ink";
  const eyebrowColor = tone === "dark" ? "text-accent" : "text-muted";
  const descriptionColor = tone === "dark" ? "text-divider-strong" : "text-body-emphasis";

  return (
    <div
      className={[
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl text-left",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {eyebrow ? (
        <p className={`mb-3 text-caption font-semibold uppercase tracking-label-wide ${eyebrowColor}`}>
          {eyebrow}
        </p>
      ) : null}
      <Heading id={id} className={`text-2xl font-semibold leading-tight tracking-display-tight ${headingColor} sm:text-3xl md:text-4xl`}>
        {title}
      </Heading>
      {description ? (
        <p className={`mt-3 max-w-2xl text-base leading-7 ${descriptionColor} md:text-lg md:leading-8`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
