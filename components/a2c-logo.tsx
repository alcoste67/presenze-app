import Image, {
  type StaticImageData,
} from "next/image";

import logoArancio from "../a2c-logo-arancio.png";
import logoNero from "../a2c-logo-nero.png";
import logoBianco from "../a2c-logo-bianco.png";

type A2CLogoColor =
  | "auto"
  | "arancio"
  | "nero"
  | "bianco";

type A2CLogoProps = {
  color?: A2CLogoColor;
  className?: string;
};

const LOGHI: Record<
  Exclude<A2CLogoColor, "auto">,
  StaticImageData
> = {
  arancio: logoArancio,
  nero: logoNero,
  bianco: logoBianco,
};

export function A2CLogo({
  color = "auto",
  className,
}: A2CLogoProps) {
  const logo =
    color === "auto"
      ? logoBianco
      : LOGHI[color];

  return (
    <Image
      src={logo}
      alt="A2C Sistemi"
      priority
      className={className}
    />
  );
}
