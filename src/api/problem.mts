export type ProblemOptions = {
  status: number;
  title: string;
  detail: string;
  instance: string;
  errors?: Array<{ path: string; message: string }>;
};

export const problemResponse = (options: ProblemOptions): Response => {
  const body = {
    type: 'about:blank',
    title: options.title,
    status: options.status,
    detail: options.detail,
    instance: options.instance,
    ...(options.errors === undefined ? {} : { errors: options.errors }),
  };

  return new Response(JSON.stringify(body), {
    status: options.status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
};
