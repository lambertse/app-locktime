#pragma once
#include "db/database.h"
#include <memory>
#include <thread>
#include <atomic>
#include <map>
#include <string>
#include <vector>
#include <ctime>

namespace locktime {

struct ProcessEntry {
    int         pid;
    std::string exe_name;
    std::string full_path;
};

class Watcher {
public:
    explicit Watcher(std::shared_ptr<Database> db);
    ~Watcher();

    // Non-copyable
    Watcher(const Watcher&) = delete;
    Watcher& operator=(const Watcher&) = delete;

    void start();
    void stop();

    /// Close all open sessions with the given reason (called on shutdown).
    void close_all_sessions(const std::string& reason);

    /// Platform-specific: enumerate currently running processes.
    std::vector<ProcessEntry> enumerate_processes();

private:
    std::shared_ptr<Database>                    db_;
    std::atomic<bool>                            running_{false};
    std::thread                                  thread_;

    /// Active tracking: rule_id → {session_id, pid}
    std::map<std::string, std::pair<int64_t, int>> active_sessions_;

    void poll_loop();
    void reconcile(const std::vector<ProcessEntry>& procs, std::time_t now);

    /// Platform-specific: terminate a process.
    void terminate_process(int pid);
};

} // namespace locktime
