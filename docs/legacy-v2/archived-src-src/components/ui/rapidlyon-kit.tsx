import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/**
 * RapidlyOn design system components.
 * Use <div className="ro-ui"> at a common layout root, and import
 * src/styles/rapidlyon-design-system.css from the corresponding layout.
 * No authentication, API, or routing behavior is changed by these components.
 */
export function RoContainer({children,className='',...props}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ro-shell ${className}`} {...props}>{children}</div>;
}
export function RoCard({children,className='',...props}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ro-card ${className}`} {...props}>{children}</div>;
}
type ButtonVariant = 'primary' | 'cream' | 'outline' | 'subtle';
export function RoButton({children,variant='primary',className='',type='button',...props}: ButtonHTMLAttributes<HTMLButtonElement>&{variant?:ButtonVariant}) {
  return <button className={`ro-btn ro-btn--${variant} ${className}`} type={type} {...props}>{children}</button>;
}
export function RoEyebrow({children,className='',...props}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`ro-eyebrow ${className}`} {...props}>{children}</p>;
}
export function RoField({label,description,id,children}: {label:string,description?:string,id:string,children:ReactNode}) {
  return <div className="ro-field"><label className="ro-label" htmlFor={id}>{label}</label>{children}{description&&<p className="ro-help">{description}</p>}</div>;
}
export function RoInput({className='',...props}:InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ro-input ${className}`} {...props}/>;
}
export function RoTextarea({className='',...props}:TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ro-input ${className}`} {...props}/>;
}
export function RoBadge({children,kind='neutral'}:{children:ReactNode,kind?:'success'|'warning'|'info'|'neutral'}) {
  return <span className={`ro-status ro-status--${kind}`}>{children}</span>;
}
export function RoPageHeader({eyebrow,title,description}:{eyebrow:string,title:string,description:string}) {
  return <section className="ro-page-head"><RoContainer><RoEyebrow>{eyebrow}</RoEyebrow><h1>{title}</h1><p className="ro-lead">{description}</p></RoContainer></section>;
}
