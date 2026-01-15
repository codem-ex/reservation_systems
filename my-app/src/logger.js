// ฟังก์ชันสำหรับเก็บ Log และดาวน์โหลดเป็นไฟล์
export const saveLog = (action, data) => {
    const timestamp = new Date().toLocaleString();
    const logEntry = `[${timestamp}] ACTION: ${action} | DATA: ${JSON.stringify(data)}\n`;

    // เก็บไว้ใน SessionStorage ชั่วคราวเพื่อให้สะสมหลายๆ Log ได้
    const currentLogs = sessionStorage.getItem('app_logs') || '';
    sessionStorage.setItem('app_logs', currentLogs + logEntry);
    console.log(logEntry);
};

export const downloadLogs = () => {
    const logs = sessionStorage.getItem('app_logs');
    if (!logs) return alert("ไม่มี Log ให้ดาวน์โหลด");

    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supabase_debug_log_${Date.now()}.txt`;
    a.click();
};