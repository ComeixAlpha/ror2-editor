import React from "react";
import "./button.css";

type Props = Pick<
  React.HTMLProps<HTMLButtonElement>,
  "children" | "style" | "onClick" | "title" | "disabled"
>;

export default function Button(props: Props): React.JSX.Element {
  const { children, style, onClick, title, disabled } = props;

  return (
    <button
      type="button"
      style={style}
      className="ror2-button"
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
