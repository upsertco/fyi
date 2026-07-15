import type { FC } from 'hono/jsx';

export const Layout: FC = (props) => {
  return (
    <html>
      <head>
        <title>{props.title}</title>
        <link
          rel="icon"
          type="image/png"
          href="/static/favicon-96x96.png"
          sizes="96x96"
        />
        <link rel="icon" type="image/svg+xml" href="/static/favicon.svg" />
        <link rel="shortcut icon" href="/static/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/static/apple-touch-icon.png"
        />
        <meta name="apple-mobile-web-app-title" content="AJD" />
        <link rel="manifest" href="/static/site.webmanifest" />
        <script src="https://unpkg.com/@tailwindcss/browser@4"></script>
      </head>
      <body class="bg-gray-900">
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">{props.children}</div>
        </div>
      </body>
    </html>
  );
};

export const ErrorPage: FC = (props) => {
  return (
    <Layout title={props.title}>
      <h1 className="text-4xl font-mono font-bold text-gray-100">
        {props.code}
      </h1>
      <h4 className="text-md font-mono font-bold text-gray-300">
        {props.children}
      </h4>
    </Layout>
  );
};
