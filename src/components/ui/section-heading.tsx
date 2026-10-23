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
        <p className={`mb-4 text-caption font-medium uppercase tracking-label-wide ${eyebrowColor}`}>
          {eyebrow}
        </p>
      ) : null}
      <Heading id={id} className={`text-3xl font-semibold tracking-display ${headingColor} sm:text-4xl md:text-5xl`}>
        {title}
      </Heading>
      {description ? (
        <p className={`mt-4 max-w-2xl text-base leading-7 ${descriptionColor} md:text-lg`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
