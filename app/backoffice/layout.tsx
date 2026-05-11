import type { ReactNode } from "react";

import { ProtezioneBackoffice } from "@/components/backoffice/ProtezioneBackoffice";

type Props = {
  children: ReactNode;
};

export default function BackofficeLayout({
  children,
}: Props) {
  return (
    <ProtezioneBackoffice>
      {children}
    </ProtezioneBackoffice>
  );
}
