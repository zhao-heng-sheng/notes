# windows恢复右键所有选项

管理员运行命令：reg.exe add "HKCU\Software(软件)\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" /f /ve 重启就恢复win10右键了

reg.exe delete "HKCU\Software(软件)\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" /va /f 这个是恢复win11右键



> [(6 封私信 / 10 条消息) 有没有什么办法可以让win11右键默认显示更多选项？ - 知乎 (zhihu.com)](https://www.zhihu.com/question/480356710)