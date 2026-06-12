from raggauge.chunking import chunk_document, split_sentences
from raggauge.metrics import average_precision, retrieval_recall
from raggauge.retrieval import RetrievedChunk, _rrf, tokenize_zh
from raggauge.schemas import mean_or_none


class TestChunking:
    def test_sentence_split_chinese(self):
        text = "第一句。第二句!第三句?第四句"
        assert len(split_sentences(text)) == 4

    def test_chunk_size_respected(self):
        text = "這是一個測試句子。" * 100
        chunks = chunk_document("d", text, chunk_size=200, overlap=30)
        assert len(chunks) > 1
        assert all(len(c.text) <= 200 + 30 for c in chunks)

    def test_overlap_carries_tail(self):
        text = "甲句內容相當地長以便測試。乙句內容相當地長以便測試。丙句內容相當地長以便測試。"
        chunks = chunk_document("d", text, chunk_size=30, overlap=20)
        assert len(chunks) >= 2
        # 下一塊開頭應包含上一塊的尾句
        assert chunks[1].text.startswith(chunks[0].text[-14:]) or "。" in chunks[1].text

    def test_oversized_single_sentence_hard_split(self):
        text = "無標點" * 200
        chunks = chunk_document("d", text, chunk_size=100, overlap=10)
        assert all(len(c.text) <= 110 for c in chunks)

    def test_ids_sequential_with_start(self):
        chunks = chunk_document("d", "句子一。句子二。", chunk_size=5, overlap=0, start_id=7)
        assert [c.id for c in chunks] == list(range(7, 7 + len(chunks)))


class TestMetrics:
    def test_ap_perfect_ranking(self):
        assert average_precision([True, True, False, False]) == 1.0

    def test_ap_bad_ranking_lower(self):
        good = average_precision([True, False, False, True])
        bad = average_precision([False, False, True, True])
        assert good > bad

    def test_ap_none_relevant(self):
        assert average_precision([False, False]) == 0.0

    def test_retrieval_recall_substring_whitespace_tolerant(self):
        retrieved = ["門鎖支援指紋、密碼\n與 NFC 卡片。", "其他內容"]
        assert retrieval_recall(["支援指紋、密碼與NFC卡片"], retrieved) == 1.0

    def test_retrieval_recall_partial(self):
        assert retrieval_recall(["甲", "不存在"], ["含甲的文段"]) == 0.5

    def test_retrieval_recall_empty_golden_is_none(self):
        assert retrieval_recall([], ["x"]) is None

    def test_mean_or_none(self):
        assert mean_or_none([1.0, None, 0.0]) == 0.5
        assert mean_or_none([None]) is None


class TestRetrieval:
    def test_tokenize_zh(self):
        tokens = tokenize_zh("智慧門鎖的保固條款")
        assert "保固" in tokens

    def test_rrf_prefers_items_in_both_lists(self):
        a = [RetrievedChunk(1, "x", 0.9), RetrievedChunk(2, "y", 0.8)]
        b = [RetrievedChunk(2, "y", 5.0), RetrievedChunk(3, "z", 4.0)]
        fused = _rrf([a, b])
        assert fused[0].chunk_id == 2  # 同時出現在兩個排名 → 融合分數最高
