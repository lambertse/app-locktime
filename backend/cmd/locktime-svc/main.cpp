#include <cstdio>
#include <string>

#include "common/constants.h"
#include "common/logger.h"
#include "service/service_manager.h"

int main(int argc, char* argv[]) {
  std::string cmd = (argc > 1) ? argv[1] : "";

  auto log_config = locktime::logger::LogConfig{
      .log_file_path = locktime::kDefaultLogFile,
      .log_level = locktime::logger::LogLevel::Info,
      .max_file_size = 10 * 1024 * 1024,  // 20 MB
      .max_files = 5,
  };
  locktime::logger::init(log_config);
  locktime::logger::log_info("locktime-svc starting (cmd={})",
                             cmd.empty() ? "--run" : cmd);

  if (cmd == "--install") {
    std::string exe_path = (argc > 0) ? argv[0] : "locktime-svc";
    auto ec = locktime::ServiceManager::install_service(exe_path);
    if (ec) {
      locktime::logger::log_error("install failed: {}", ec.message());
      std::fprintf(stderr, "install failed: %s\n", ec.message().c_str());
      return 1;
    }
    locktime::logger::log_info("service installed successfully");
    std::fprintf(stdout, "Service installed successfully.\n");
    return 0;
  }

  if (cmd == "--uninstall") {
    auto ec = locktime::ServiceManager::uninstall_service();
    if (ec) {
      locktime::logger::log_error("uninstall failed: {}", ec.message());
      std::fprintf(stderr, "uninstall failed: %s\n", ec.message().c_str());
      return 1;
    }
    locktime::logger::log_info("service uninstalled successfully");
    std::fprintf(stdout, "Service uninstalled successfully.\n");
    return 0;
  }

  if (cmd == "--run" || cmd.empty()) {
    return locktime::ServiceManager::run_service();
  }

  std::fprintf(stderr, "Usage: locktime-svc [--install|--uninstall|--run]\n");
  return 1;
}
