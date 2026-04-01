#include "logger.h"

#include <spdlog/sinks/rotating_file_sink.h>
#include <spdlog/spdlog.h>

namespace locktime {
namespace logger {

void init(const LogConfig& config) {
  auto logger =
      spdlog::rotating_logger_mt("file_logger", config.log_file_path.string(),
                                 config.max_file_size, config.max_files);
  logger->set_level(static_cast<spdlog::level::level_enum>(config.log_level));
  logger->set_pattern("[%Y-%m-%d %H:%M:%S] [%l] %v");
  spdlog::set_default_logger(logger);
}

}  // namespace logger
}  // namespace locktime
