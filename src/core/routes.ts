import { Composer } from "grammy";
import { CustomContext } from "../types/context";
import { createRoute } from "../features/bootanimation/route";

const routeComposer = new Composer<CustomContext>()

// Bootanimation Modules Routes
routeComposer.use(createRoute)




export default routeComposer
