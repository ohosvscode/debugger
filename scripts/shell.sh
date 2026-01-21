#!/bin/bash

# ================= 参数解析区域 =================
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 检查是否提供了包名
if [ -z "$1" ]; then
    echo -e "${RED}[Error] 未提供包名 (Bundle Name)${NC}"
    echo -e "用法: $0 <BundleName> [AbilityName]"
    echo -e "示例: $0 com.example.app"
    echo -e "示例: $0 com.example.app MainAbility"
    exit 1
fi

BUNDLE_NAME="$1"
# 如果第二个参数为空，默认使用 EntryAbility
ABILITY_NAME="${2:-EntryAbility}"

echo -e "${GREEN}>>> 配置已加载:${NC}"
echo -e "    Bundle : ${CYAN}${BUNDLE_NAME}${NC}"
echo -e "    Ability: ${CYAN}${ABILITY_NAME}${NC}"
echo ""

# ================= check wscat =================
if ! command -v wscat &> /dev/null; then
    echo -e "${RED}[Error] 未检测到 wscat 工具${NC}"
    echo -e "请先运行: ${YELLOW}npm install -g wscat${NC}"
    exit 1
fi

# ===========================================

function log_info() { echo -e "${GREEN}[INFO] $1${NC}"; }
function log_step() { echo -e "${BLUE}[STEP] $1${NC}"; }
function log_err()  { echo -e "${RED}[ERROR] $1${NC}"; }

function force_clear_ports() {
    hdc fport ls | grep -E "tcp:9229|tcp:9230" | while read -r line ; do
        PORT=$(echo "$line" | awk '{print $2}')
        TASK=$(echo "$line" | awk '{print $3}')
        if [ ! -z "$PORT" ] && [ ! -z "$TASK" ]; then
            echo "   -> [Clean] 移除残留: $PORT $TASK"
            hdc fport rm "$PORT" "$TASK" > /dev/null 2>&1
        fi
    done
}

function cleanup_env() {
    echo ""
    log_step "正在执行资源回收..."
    if [ ! -z "$KEEP_ALIVE_PID" ]; then
        kill $KEEP_ALIVE_PID 2>/dev/null
        echo "   -> 已停止保活进程"
    fi
    force_clear_ports
    log_info "资源清理完毕。"
}
trap cleanup_env EXIT

# ==========================================================
# 1. 环境初始化
# ==========================================================
log_step "环境初始化..."
force_clear_ports

log_step "重启应用 (Debug Mode)..."
hdc shell aa force-stop $BUNDLE_NAME > /dev/null
sleep 0.5
hdc shell aa start -a $ABILITY_NAME -b $BUNDLE_NAME -D > /dev/null

# ==========================================================
# 2. 捕获 PID
# ==========================================================
log_step "正在捕获 PID..."
TMP_LOG=$(mktemp)
hdc track-jpid > "$TMP_LOG" &
TRACKER_PID=$!
TARGET_PID=""
for i in {1..20}; do
    FOUND=$(grep -m 1 "$BUNDLE_NAME" "$TMP_LOG")
    if [ ! -z "$FOUND" ]; then
        TARGET_PID=$(echo "$FOUND" | awk '{print $1}')
        break
    fi
    sleep 0.5
done
kill $TRACKER_PID 2>/dev/null
rm "$TMP_LOG" 2>/dev/null

if [ -z "$TARGET_PID" ]; then log_err "PID 获取超时！"; exit 1; fi
log_info "目标 PID: $TARGET_PID"

# ==========================================================
# 3. 建立 9229 (DevTools UI 通道 - 保活)
# ==========================================================
log_step "配置 Debug 端口 (9229)..."
OUT1=$(hdc fport tcp:9229 ark:$TARGET_PID@$BUNDLE_NAME)
if [[ "$OUT1" == *"Fail"* ]]; then log_err "$OUT1"; exit 1; fi

# 启动保活 (使用 wscat 维持 9229 连接)
# 注意：这会占用 9229，所以 Chrome 必须连 9230
( echo '{"type":"connected"}'; sleep 1d ) | wscat -c ws://127.0.0.1:9229 > /dev/null 2>&1 &
KEEP_ALIVE_PID=$!
log_info ">>> 9229 通道已锁定 (PID: $KEEP_ALIVE_PID)"

sleep 1

# ==========================================================
# 4. 建立 9230 (控制指令/Chrome 连接通道)
# ==========================================================
log_step "配置注入端口 (9230)..."
OUT2=$(hdc fport tcp:9230 ark:$TARGET_PID@Debugger)
if [[ "$OUT2" == *"Fail"* ]]; then log_err "$OUT2"; exit 1; fi

# 备注：此处已注释掉注入逻辑，交由 Chrome 完成握手
# DEBUG_PAYLOAD='...'
# ( ... ) | wscat -c ws://127.0.0.1:9230

# ==========================================================
# 5. 生成直连地址并挂起
# ==========================================================
echo ""
log_info "✅ 调试环境已就绪！"

# 构造强制直连 URL (指向 9230)
DT_URL="devtools://devtools/bundled/inspector.html?v8only=true&ws=127.0.0.1:9230"

echo -e "----------------------------------------------------------------"
echo -e "${YELLOW}由于自动嗅探失效，请复制下方链接到 Chrome 地址栏:${NC}"
echo -e ""
echo -e "${CYAN}${DT_URL}${NC}"
echo -e ""
echo -e "${YELLOW}(注意：如果 Chrome 阻止该协议，请先在浏览器打开空白页再粘贴)${NC}"
echo -e "----------------------------------------------------------------"
echo -e ">> 按 [Enter] 键结束调试 <<"

read confirm_exit
