export const isExcelFile = (file: File) =>
  /\.(xlsx|xlsm)$/i.test(file.name) ||
  file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
  file.type === "application/vnd.ms-excel.sheet.macroEnabled.12"
