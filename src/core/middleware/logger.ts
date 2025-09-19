import { NextFunction } from "grammy";
import { CustomContext } from "../../types/context";

export async function loggerMiddleware(ctx: CustomContext, next: NextFunction) {
  const start = Date.now();

  await next();

  const duration = Date.now() - start;

  // Extract useful info
  const user = ctx.from
    ? `${ctx.from.first_name}${ctx.from.last_name ? " " + ctx.from.last_name : ""} (${ctx.from.id})`
    : "Unknown user";

  const messagePreview =
    ctx.message?.text?.slice(0, 50) ??
    ctx.message?.video
      ? "[Video]"
      : ctx.callbackQuery?.data
      ? `[Callback: ${ctx.callbackQuery.data}]`
      : "[Other update]";

  // Prepare router info
  const routerInfo = {
    path: ctx.router?.path ?? null,
    history: ctx.router?.history ?? [],
  };

  // Prepare form info
  const formInfo = ctx.form
    ? ctx.form.all()
    : {};

  // Log nicely
  console.log("───────────────────────────────");
  console.log(`📨 Update from: ${user}`);
  console.log(`💬 Message: ${messagePreview}`);
  console.log(`🛣️ Router:`);
  console.log(`   - Path: ${routerInfo.path}`);
  console.log(`   - History: ${JSON.stringify(routerInfo.history)}`);
  console.log(`📝 Form state:`);
  console.log(JSON.stringify(formInfo, null, 2));
  console.log(`⏱️ Duration: ${duration}ms`);
  console.log("───────────────────────────────\n");
}