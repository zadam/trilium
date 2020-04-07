import glob from './services/glob.js';
import macInit from './services/mac_init.js';
import options from "./services/options.js";
import noteContentRenderer from "./services/note_content_renderer.js";
import appContext from "./services/app_context.js";
import FlexContainer from "./widgets/flex_container.js";
import EmptyTypeWidget from "./widgets/type_widgets/empty.js";
import TextTypeWidget from "./widgets/type_widgets/editable_text.js";
import CodeTypeWidget from "./widgets/type_widgets/code.js";
import FileTypeWidget from "./widgets/type_widgets/file.js";
import ImageTypeWidget from "./widgets/type_widgets/image.js";
import SearchTypeWidget from "./widgets/type_widgets/search.js";
import RenderTypeWidget from "./widgets/type_widgets/render.js";
import RelationMapTypeWidget from "./widgets/type_widgets/relation_map.js";
import ProtectedSessionTypeWidget from "./widgets/type_widgets/protected_session.js";
import BookTypeWidget from "./widgets/type_widgets/book.js";
import MobileLayout from "./widgets/mobile_layout.js";

macInit.init();

appContext.setLayout(new MobileLayout());
appContext.start();