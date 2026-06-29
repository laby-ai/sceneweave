"use client";

import { App } from "antd";
import { copyText } from "@/icanvas/lib/copy-text";

export function useCopyText() {
    const { message } = App.useApp();

    return (value: string, successText = "已复制") => {
        void copyText(value).then((ok) => {
            if (ok) {
                message.success(successText);
                return;
            }
            message.warning("复制失败，请手动复制");
        });
    };
}
