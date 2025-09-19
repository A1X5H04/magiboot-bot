import { Router } from "@grammyjs/router";
import { CustomContext } from "../../types/context";
import { handleGetVideo } from "./handlers";

export const createRoute = new Router<CustomContext>(ctx => ctx.router.path);


createRoute.route("bootanimation:create:getVideo").on([":document", "msg:video"], handleGetVideo)



createRoute.otherwise((ctx) => ctx.reply("Invalid input"));