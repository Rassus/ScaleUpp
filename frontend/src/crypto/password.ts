/** SHA-256 hex de la contraseña — se envía al API; el servidor aplica bcrypt encima. */
export async function hashPasswordClient(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
