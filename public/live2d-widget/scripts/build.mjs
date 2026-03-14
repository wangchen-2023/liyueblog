import { writeFile } from "node:fs/promises";
import { rollup } from "rollup";
import { minify } from "terser";

import config from "../rollup.config.js";

const bundle = await rollup(config);

try {
    const { output } = await bundle.generate({
        format: "iife"
    });
    const code = output
        .filter(item => item.type === "chunk")
        .map(item => item.code)
        .join("\n");

    const result = await minify(code, {
        compress: true,
        mangle: true
    });

    if (!result.code) {
        throw new Error("Failed to generate waifu-tips.js");
    }

    await writeFile(new URL("../waifu-tips.js", import.meta.url), result.code, "utf8");
} finally {
    await bundle.close();
}
