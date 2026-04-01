#pragma once
#include <spdlog/spdlog.h>

#include <filesystem>

namespace locktime {
namespace logger {

enum class LogLevel { Trace = 0, Debug, Info, Warning, Error, Critical, Off };

struct LogConfig {
  std::filesystem::path log_file_path;
  LogLevel log_level;
  size_t max_file_size;  // in bytes
  size_t max_files;      // number of rotated files to keep
};

void init(const LogConfig& config);

template <typename... Args>
void log_info(fmt::format_string<Args...> fmt, Args&&... args) {
  spdlog::get("file_logger")->info(fmt, std::forward<Args>(args)...);
}

template <typename... Args>
void log_error(fmt::format_string<Args...> fmt, Args&&... args) {
  spdlog::get("file_logger")->error(fmt, std::forward<Args>(args)...);
}

template <typename... Args>
void log_debug(fmt::format_string<Args...> fmt, Args&&... args) {
  spdlog::get("file_logger")->debug(fmt, std::forward<Args>(args)...);
}

template <typename... Args>
void log_warning(fmt::format_string<Args...> fmt, Args&&... args) {
  spdlog::get("file_logger")->warn(fmt, std::forward<Args>(args)...);
}

template <typename... Args>
[[noreturn]] void log_fatal(fmt::format_string<Args...> fmt, Args&&... args) {
  spdlog::get("file_logger")->critical(fmt, std::forward<Args>(args)...);
  std::abort();
}

}  // namespace logger
}  // namespace locktime
