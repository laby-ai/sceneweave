# Huiying Subpath Deployment

Huiying is published under `/huiying` on the StoneAI nginx host.

The production build must be created with an explicit Next base path:

```bash
NEXT_PUBLIC_BASE_PATH=/huiying pnpm build
```

Do not rely on nginx `sub_filter` to rewrite `/_next/static/` into
`/huiying/_next/static/` for this app. When the bundle is built with the real
base path, `sub_filter` can turn valid asset URLs into
`/huiying/huiying/_next/...`, which leaves the public page blank.

The nginx `/huiying` locations should proxy to the Huiying service without
static-path rewriting:

```nginx
location = /huiying {
    proxy_pass http://127.0.0.1:5100/huiying;
}

location ^~ /huiying/ {
    proxy_pass http://127.0.0.1:5100;
}
```

Keep the generated video alias before the generic `/huiying/` proxy so finished
MP4 files can still be served directly:

```nginx
location ^~ /huiying/generated/videos/ {
    alias /opt/huiying/current/public/generated/videos/;
}
```

After changes, verify all of these before calling the deploy healthy:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/huiying
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/huiying/canvas
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/huiying/api/health
```

Then open the public `/huiying` page in a browser and confirm that:

- the body renders text and controls;
- script and stylesheet URLs do not contain `/huiying/huiying`;
- no `/_next/static` asset returns 404.
