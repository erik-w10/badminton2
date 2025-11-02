import { reactive } from "vue";
import { IModalBase, ModalBase } from "./modal_base";
import { default as adm } from "./player_admin";

let bypassAdminTest = false;

function disableAdminTest() {
    bypassAdminTest = true;
}

interface IAdminTest extends IModalBase {
    hide    : () => void
    action  : (success : boolean) => void,
    display : (action : (success : boolean) => void) => void,
};
class AdminTestClass extends ModalBase implements IAdminTest {
    hide() {
        this.show = false;
    }
    action : (success : boolean) => void = () => {};
    display(action : (success : boolean) => void) {
        if (this.show) {
            console.log("Double admin test, immediately failing");
            action(false);
        }
        else if (bypassAdminTest || (adm.admins.length === 0)) {
            console.log("Bypassing admin test");
            adm.currentAdmin = null;
            action(true);
        }
        else {
            this.action = (success : boolean) => {
                this.show = false;
                action(success);
            }
            this.show = true;
        }
    }
};
let admin_test = reactive(new AdminTestClass("AdminTest"));
function doAdminTest(action : (success : boolean) => void) { admin_test.display(action); }

export { type IAdminTest, disableAdminTest, admin_test, doAdminTest }
