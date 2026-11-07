import React, { useState } from "react";
import {
  FolderPlus,
  UserPlus,
  FolderKanban,
  KeyRound,
  Loader2,
  ArrowRight,
  Search,
  LayoutGrid,
  List,
} from "lucide-react";
import ProjectCard from "../../ProjectCard";

// Trang danh sách dự án: thẻ tạo / tham gia + danh sách có lọc
export default function ProjectListView({
  projectList,
  isLoadingProjects,
  onOpenCreate,
  joinCode,
  setJoinCode,
  isJoiningProject,
  onJoinProject,
  copiedId,
  copyJoinCode,
  setSelectedProject,
  handleDeleteProject,
  onEditProject,
  onCompleteProject,
}) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");

  const keyword = searchKeyword.toLowerCase();

  const filteredProjects = projectList.filter((project) => {
    const name = (project.name || "").toLowerCase();
    const code = (project.join_code || "").toLowerCase();

    const matchesKeyword = name.includes(keyword) || code.includes(keyword);
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;

    return matchesKeyword && matchesStatus;
  });

  const renderCards = (mode) =>
    filteredProjects.map((project) => (
      <ProjectCard
        key={project.id}
        project={project}
        viewMode={mode}
        copiedId={copiedId}
        copyJoinCode={copyJoinCode}
        setSelectedProject={setSelectedProject}
        handleDeleteProject={handleDeleteProject}
        onEditProject={onEditProject}
        onCompleteProject={onCompleteProject}
      />
    ));

  return (
    <>
      <div className="tieu-de-trang-quan-ly">
        <h2 className="tieu-de-chinh">Quản lý Dự án</h2>

        <p className="tieu-de-phu">
          Khởi tạo dự án mới, phân quyền Trưởng nhóm và theo dõi tiến độ công
          việc
        </p>
      </div>

      <div className="luoi-hanh-dong-du-an">
        {/* TẠO DỰ ÁN */}
        <div className="the-hanh-dong">
          <div className="bieu-tuong-the">
            <FolderPlus size={22} />
          </div>

          <h3>Tạo Dự Án Mới</h3>

          <p className="mo-ta-the">
            Thiết lập không gian quản lý tiến độ và công việc riêng cho đội ngũ
            của bạn
          </p>

          <button type="button" className="nut-chinh" onClick={onOpenCreate}>
            <FolderPlus size={16} />
            <span>Tạo Dự Án</span>
          </button>
        </div>

        {/* THAM GIA DỰ ÁN */}
        <div className="the-hanh-dong">
          <div className="bieu-tuong-the phu">
            <UserPlus size={22} />
          </div>

          <h3>Tham Gia Dự Án</h3>

          <p className="mo-ta-the">
            Nhập mã mời (Join Code) được chia sẻ từ quản trị viên để tham gia
          </p>

          <form onSubmit={onJoinProject} className="form-hanh-dong">
            <div className="nhom-nhap-lieu">
              <KeyRound size={18} className="bieu-tuong-input" />

              <input
                type="text"
                placeholder="Nhập mã tham gia (VD: DEV-8892)..."
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="o-nhap-lieu"
                required
              />
            </div>

            <button type="submit" disabled={isJoiningProject} className="nut-phu">
              {isJoiningProject ? (
                <Loader2 size={16} className="icon-quay" />
              ) : (
                <ArrowRight size={16} />
              )}

              <span>
                {isJoiningProject ? "Đang tham gia..." : "Tham Gia Ngay"}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* DANH SÁCH DỰ ÁN */}
      <div className="khung-danh-sach-du-an">
        <div className="thanh-tieu-de-section">
          <div className="nhom-tieu-de">
            <FolderKanban size={20} className="icon-tieu-de" />
            <h3>Dự án của bạn ({filteredProjects.length})</h3>
          </div>

          <div className="nhom-cong-cu">
            <div className="khung-tim-kiem">
              <Search size={16} className="icon-tim-kiem" />

              <input
                type="text"
                placeholder="Tìm kiếm dự án hoặc mã..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>

            <select
              className="bo-loc-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang thực hiện</option>
              <option value="completed">Đã hoàn thành</option>
            </select>

            <div className="chuyen-che-do-xem">
              <button
                className={`nut-che-do ${viewMode === "grid" ? "dang-chon" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Chế độ Lưới"
              >
                <LayoutGrid size={16} />
              </button>

              <button
                className={`nut-che-do ${viewMode === "list" ? "dang-chon" : ""}`}
                onClick={() => setViewMode("list")}
                title="Chế độ Danh sách"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {isLoadingProjects ? (
          <div className="trang-thai-trong">
            <Loader2 size={48} className="icon-quay" />
            <p>Đang tải danh sách dự án...</p>
          </div>
        ) : filteredProjects.length > 0 ? (
          viewMode === "grid" ? (
            <div className="luoi-the-du-an">{renderCards("grid")}</div>
          ) : (
            <div className="danh-sach-dang-dong">{renderCards("list")}</div>
          )
        ) : (
          <div className="trang-thai-trong">
            <FolderKanban size={48} className="icon-trong" />

            <p>
              {searchKeyword
                ? `Không tìm thấy dự án nào khớp với "${searchKeyword}"`
                : "Chưa có dự án nào trong danh sách. Hãy khởi tạo hoặc tham gia dự án ngay!"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
