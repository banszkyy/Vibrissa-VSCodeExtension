using System;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace LanguageCore.SyntaxGenerator;

static class Program
{
    static string? _projectPath;
    public static string ProjectPath => _projectPath ??= GetProjectPath();
    static string GetProjectPath([CallerFilePath] string? callerFilePath = null) => Path.GetDirectoryName(callerFilePath ?? throw new Exception($"Failed to get the project path"))!;

    static void Main()
    {
        File.WriteAllText(Path.Combine(GetProjectPath(), "..", "syntax", "meow.json"), JsonSerializer.Serialize(Source.Generate(), Converter.JsonOptions));
        File.WriteAllText(Path.Combine(GetProjectPath(), "..", "syntax", "msil.json"), JsonSerializer.Serialize(MSIL.Generate(), Converter.JsonOptions));
        File.WriteAllText(Path.Combine(GetProjectPath(), "..", "syntax", "meow-il.json"), JsonSerializer.Serialize(VibrissaIL.Generate(), Converter.JsonOptions));
        File.WriteAllText(Path.Combine(GetProjectPath(), "..", "syntax", "meow-test-result.json"), JsonSerializer.Serialize(TestResultSource.Generate(), Converter.JsonOptions));
    }
}
